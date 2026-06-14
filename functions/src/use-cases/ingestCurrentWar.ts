import {
  Result,
  ok,
  err,
  MappedWar,
  MappedWarMember,
  MappedAttack,
  SyncState,
  CocApiError,
  WarHeader,
  diffWar,
  getWarId,
} from '@clash-tracker/core';

export interface IngestSummary {
  readonly status: 'nothing-to-ingest' | 'synced';
  readonly warId: string | null;
  readonly attacksAdded: number;
}

export interface IngestCurrentWarDeps {
  readonly gateway: {
    readonly getCurrentWar: (clanTag: string) => Promise<Result<MappedWar, CocApiError>>;
  };
  readonly warRepo: {
    readonly getWar: (warId: string) => Promise<Result<MappedWar | null, string>>;
    readonly getActiveWar: () => Promise<Result<{ warId: string; war: MappedWar } | null, string>>;
    readonly saveWarHeader: (warId: string, header: WarHeader) => Promise<void>;
    readonly upsertMembers: (
      warId: string,
      members: readonly MappedWarMember[],
      isOpponent: boolean
    ) => Promise<void>;
    readonly updateSyncStatus: (
      warId: string,
      syncState: SyncState,
      lastSyncedAt: string
    ) => Promise<void>;
  };
  readonly attackRepo: {
    readonly addAttacks: (warId: string, attacks: readonly MappedAttack[]) => Promise<void>;
  };
  readonly now: () => Date;
}

export function makeIngestCurrentWar(deps: IngestCurrentWarDeps) {
  const { gateway, warRepo, attackRepo, now } = deps;

  return async (clanTag: string): Promise<Result<IngestSummary, string>> => {
    // 1. Fetch from gateway
    const fetchResult = await gateway.getCurrentWar(clanTag);
    if (!fetchResult.success) {
      // Flag the active war out-of-sync on gateway failure
      const activeResult = await warRepo.getActiveWar();
      if (activeResult.success && activeResult.value) {
        await warRepo.updateSyncStatus(
          activeResult.value.warId,
          'out-of-sync',
          now().toISOString()
        );
      }
      return err(`Gateway fetch failed: ${fetchResult.error}`);
    }

    const fetched = fetchResult.value;

    // 2. Check if there is nothing to ingest
    if (fetched.state === 'notInWar' || fetched.state === 'preparation') {
      return ok({
        status: 'nothing-to-ingest',
        warId: null,
        attacksAdded: 0,
      });
    }

    const warId = getWarId(clanTag, fetched.opponentTag, fetched.preparationStartTime);

    // 3. Load stored war
    const storedResult = await warRepo.getWar(warId);
    if (!storedResult.success) {
      return err(`Failed to load stored war: ${storedResult.error}`);
    }
    const stored = storedResult.value;

    // 4. Compute diff
    const diff = diffWar(stored, fetched);

    // 5. Apply modifications (orchestrate)
    if (diff.warHeader) {
      await warRepo.saveWarHeader(warId, diff.warHeader);
    }

    if (!stored) {
      // First ingestion: write both clan members and opponent members
      await warRepo.upsertMembers(warId, fetched.clanMembers, false);
      await warRepo.upsertMembers(warId, fetched.opponentMembers, true);
    } else if (diff.memberUpdates.length > 0) {
      // Subsequent ingestion: write only updated members (clan members)
      await warRepo.upsertMembers(warId, diff.memberUpdates, false);
    }

    if (diff.attacksToAdd.length > 0) {
      await attackRepo.addAttacks(warId, diff.attacksToAdd);
    }

    // 6. Update sync status
    await warRepo.updateSyncStatus(warId, 'synced', now().toISOString());

    return ok({
      status: 'synced',
      warId,
      attacksAdded: diff.attacksToAdd.length,
    });
  };
}
