import { MappedWar, MappedWarMember, MappedAttack } from './mappers';
import { getAttackId } from './identity';
import { SyncState } from './domain';

export interface WarHeader {
  readonly state: 'preparation' | 'inWar' | 'warEnded';
  readonly teamSize: number;
  readonly opponentName: string;
  readonly opponentTag: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly preparationStartTime: string;
}

export interface WarDiff {
  readonly warHeader: WarHeader | null;
  readonly memberUpdates: readonly MappedWarMember[];
  readonly attacksToAdd: readonly (MappedAttack & { readonly id: string })[];
}

export interface IngestionSyncStatus {
  readonly syncState: SyncState;
  readonly lastSyncedAt: string;
}

/**
 * Helper to collect all unique attacks from a MappedWar.
 */
export function extractAllAttacks(
  war: MappedWar
): readonly (MappedAttack & { readonly id: string })[] {
  const attacks: (MappedAttack & { id: string })[] = [];
  const seenIds = new Set<string>();

  const processMembers = (members: readonly MappedWarMember[]) => {
    for (const member of members) {
      for (const attack of member.attacks) {
        const id = getAttackId(attack.attackerTag, attack.defenderTag, attack.order);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          attacks.push({
            ...attack,
            id,
          });
        }
      }
    }
  };

  processMembers(war.clanMembers);
  processMembers(war.opponentMembers);

  return attacks;
}

/**
 * Pure function comparing the stored war (if any) and the fetched war
 * to compute the diff of changes to write.
 */
export function diffWar(stored: MappedWar | null, fetched: MappedWar): WarDiff {
  if (fetched.state === 'notInWar') {
    return {
      warHeader: null,
      memberUpdates: [],
      attacksToAdd: [],
    };
  }

  if (!stored) {
    const warHeader: WarHeader = {
      state: fetched.state,
      teamSize: fetched.teamSize,
      opponentName: fetched.opponentName,
      opponentTag: fetched.opponentTag,
      startTime: fetched.startTime,
      endTime: fetched.endTime,
      preparationStartTime: fetched.preparationStartTime,
    };

    const allAttacks = extractAllAttacks(fetched);

    return {
      warHeader,
      memberUpdates: fetched.clanMembers,
      attacksToAdd: allAttacks,
    };
  }

  // Compare war header
  const headerChanged =
    stored.state !== fetched.state ||
    stored.teamSize !== fetched.teamSize ||
    stored.opponentName !== fetched.opponentName ||
    stored.opponentTag !== fetched.opponentTag ||
    stored.startTime !== fetched.startTime ||
    stored.endTime !== fetched.endTime ||
    stored.preparationStartTime !== fetched.preparationStartTime;

  const warHeader: WarHeader | null = headerChanged
    ? {
        state: fetched.state,
        teamSize: fetched.teamSize,
        opponentName: fetched.opponentName,
        opponentTag: fetched.opponentTag,
        startTime: fetched.startTime,
        endTime: fetched.endTime,
        preparationStartTime: fetched.preparationStartTime,
      }
    : null;

  // Compare attacks (idempotency)
  const storedAttacks = extractAllAttacks(stored);
  const fetchedAttacks = extractAllAttacks(fetched);

  const storedAttackIds = new Set(storedAttacks.map((a) => a.id));
  const attacksToAdd = fetchedAttacks.filter((a) => !storedAttackIds.has(a.id));

  // Determine updated members
  const memberUpdates = fetched.clanMembers.filter((f) => {
    const s = stored.clanMembers.find((m) => m.tag === f.tag);
    if (!s) return true;
    return (
      s.townHallLevel !== f.townHallLevel ||
      s.mapPosition !== f.mapPosition ||
      s.attacks.length !== f.attacks.length ||
      s.defenses.length !== f.defenses.length
    );
  });

  return {
    warHeader,
    memberUpdates,
    attacksToAdd,
  };
}

/**
 * Computes whether the stored war is in sync with the fetched war.
 */
export function computeSyncState(stored: MappedWar | null, fetched: MappedWar): SyncState {
  if (!stored) {
    return 'out-of-sync';
  }

  const diff = diffWar(stored, fetched);
  const hasChanges =
    diff.warHeader !== null || diff.memberUpdates.length > 0 || diff.attacksToAdd.length > 0;

  return hasChanges ? 'out-of-sync' : 'synced';
}

/**
 * Pure helper to construct the sync status structure using the injected clock/time.
 */
export function updateSyncStatus(syncState: SyncState, now: Date): IngestionSyncStatus {
  return {
    syncState,
    lastSyncedAt: now.toISOString(),
  };
}
