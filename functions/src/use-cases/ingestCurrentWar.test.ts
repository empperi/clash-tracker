import { describe, it, expect, beforeEach } from 'vitest';
import {
  Result,
  ok,
  err,
  MappedWar,
  SyncState,
  CocApiError,
  mapWar,
  WarHeader,
  MappedWarMember,
  MappedAttack,
} from '@clash-tracker/core';
import { makeIngestCurrentWar } from './ingestCurrentWar';

// Import JSON fixtures
import warNotInWarFixture from '../../../packages/core/src/fixtures/war_notInWar.json';
import warPrepFixture from '../../../packages/core/src/fixtures/war_prep.json';
import warMid1Fixture from '../../../packages/core/src/fixtures/war_inWar.json';
import warMid2Fixture from '../../../packages/core/src/fixtures/war_mid2.json';
import warEndedFixture from '../../../packages/core/src/fixtures/war_ended_final.json';

// Define the in-memory implementations
class InMemoryWarRepository {
  public wars = new Map<string, MappedWar>();
  public syncStates = new Map<string, { syncState: SyncState; lastSyncedAt: string }>();

  async getWar(warId: string): Promise<Result<MappedWar | null, string>> {
    return ok(this.wars.get(warId) || null);
  }

  async getActiveWar(): Promise<Result<{ warId: string; war: MappedWar } | null, string>> {
    for (const [warId, war] of this.wars.entries()) {
      if (war.state === 'preparation' || war.state === 'inWar') {
        return ok({ warId, war });
      }
    }
    return ok(null);
  }

  async saveWarHeader(warId: string, header: WarHeader): Promise<void> {
    const existing = this.wars.get(warId) || {
      state: header.state,
      teamSize: header.teamSize,
      opponentName: header.opponentName,
      opponentTag: header.opponentTag,
      startTime: header.startTime,
      endTime: header.endTime,
      preparationStartTime: header.preparationStartTime,
      clanMembers: [],
      opponentMembers: [],
    };
    this.wars.set(warId, {
      ...existing,
      state: header.state,
      teamSize: header.teamSize,
      opponentName: header.opponentName,
      opponentTag: header.opponentTag,
      startTime: header.startTime,
      endTime: header.endTime,
      preparationStartTime: header.preparationStartTime,
    });
  }

  async upsertMembers(
    warId: string,
    members: readonly MappedWarMember[],
    isOpponent: boolean
  ): Promise<void> {
    const existing = this.wars.get(warId);
    if (!existing) return;

    if (isOpponent) {
      const updatedOpponents = [...existing.opponentMembers];
      for (const m of members) {
        const idx = updatedOpponents.findIndex((o) => o.tag === m.tag);
        if (idx >= 0) {
          updatedOpponents[idx] = m;
        } else {
          updatedOpponents.push(m);
        }
      }
      this.wars.set(warId, { ...existing, opponentMembers: updatedOpponents });
    } else {
      const updatedClan = [...existing.clanMembers];
      for (const m of members) {
        const idx = updatedClan.findIndex((c) => c.tag === m.tag);
        if (idx >= 0) {
          updatedClan[idx] = m;
        } else {
          updatedClan.push(m);
        }
      }
      this.wars.set(warId, { ...existing, clanMembers: updatedClan });
    }
  }

  async updateSyncStatus(warId: string, syncState: SyncState, lastSyncedAt: string): Promise<void> {
    this.syncStates.set(warId, { syncState, lastSyncedAt });
  }
}

class InMemoryAttackRepository {
  constructor(private readonly warRepo: InMemoryWarRepository) {}

  async addAttacks(warId: string, attacks: readonly MappedAttack[]): Promise<void> {
    const war = this.warRepo.wars.get(warId);
    if (!war) return;

    const updatedClan = war.clanMembers.map((member) => {
      const memberAttacks = attacks.filter((a) => a.attackerTag === member.tag);
      const memberDefenses = attacks.filter((a) => a.defenderTag === member.tag);

      const newAttacks = [...member.attacks];
      for (const att of memberAttacks) {
        if (!newAttacks.some((a) => a.order === att.order)) {
          newAttacks.push(att);
        }
      }
      const newDefenses = [...member.defenses];
      for (const def of memberDefenses) {
        if (!newDefenses.some((d) => d.order === def.order)) {
          newDefenses.push(def);
        }
      }

      return {
        ...member,
        attacks: newAttacks.sort((a, b) => a.order - b.order),
        defenses: newDefenses.sort((a, b) => a.order - b.order),
      };
    });

    const updatedOpponent = war.opponentMembers.map((member) => {
      const memberAttacks = attacks.filter((a) => a.attackerTag === member.tag);
      const memberDefenses = attacks.filter((a) => a.defenderTag === member.tag);

      const newAttacks = [...member.attacks];
      for (const att of memberAttacks) {
        if (!newAttacks.some((a) => a.order === att.order)) {
          newAttacks.push(att);
        }
      }
      const newDefenses = [...member.defenses];
      for (const def of memberDefenses) {
        if (!newDefenses.some((d) => d.order === def.order)) {
          newDefenses.push(def);
        }
      }

      return {
        ...member,
        attacks: newAttacks.sort((a, b) => a.order - b.order),
        defenses: newDefenses.sort((a, b) => a.order - b.order),
      };
    });

    this.warRepo.wars.set(warId, {
      ...war,
      clanMembers: updatedClan,
      opponentMembers: updatedOpponent,
    });
  }
}

class FakeGateway {
  public currentWarResult: Result<MappedWar, CocApiError> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getCurrentWar(clanTag: string): Promise<Result<MappedWar, CocApiError>> {
    if (!this.currentWarResult) {
      return err('Unknown');
    }
    return this.currentWarResult;
  }
}

describe('makeIngestCurrentWar Use Case', () => {
  let gateway: FakeGateway;
  let warRepo: InMemoryWarRepository;
  let attackRepo: InMemoryAttackRepository;
  let nowFn: () => Date;
  let nowTime: Date;

  beforeEach(() => {
    gateway = new FakeGateway();
    warRepo = new InMemoryWarRepository();
    attackRepo = new InMemoryAttackRepository(warRepo);
    nowTime = new Date('2026-06-14T20:00:00.000Z');
    nowFn = () => nowTime;
  });

  it('notInWar/preparation-only -> no war persisted, summary says nothing to ingest', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });

    // 1. notInWar state
    gateway.currentWarResult = ok(mapWar(warNotInWarFixture));
    const result1 = await ingest('#CLAN1');
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.value.status).toBe('nothing-to-ingest');
      expect(result1.value.warId).toBeNull();
      expect(result1.value.attacksAdded).toBe(0);
    }
    expect(warRepo.wars.size).toBe(0);

    // 2. preparation state (preparation-only)
    gateway.currentWarResult = ok(mapWar(warPrepFixture));
    const result2 = await ingest('#CLAN1');
    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.value.status).toBe('nothing-to-ingest');
      expect(result2.value.warId).toBeNull();
    }
    expect(warRepo.wars.size).toBe(0);
  });

  it('first inWar fetch -> war + members + attacks stored, state synced', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });
    gateway.currentWarResult = ok(mapWar(warMid1Fixture));

    const result = await ingest('#CLAN1');
    expect(result.success).toBe(true);

    let ingestedWarId = '';
    if (result.success) {
      expect(result.value.status).toBe('synced');
      expect(result.value.warId).not.toBeNull();
      ingestedWarId = result.value.warId!;
      expect(result.value.attacksAdded).toBe(2);
    }

    const storedWar = warRepo.wars.get(ingestedWarId);
    expect(storedWar).toBeDefined();
    expect(storedWar?.state).toBe('inWar');
    expect(storedWar?.clanMembers).toHaveLength(2);
    expect(storedWar?.opponentMembers).toHaveLength(2);

    const syncStatus = warRepo.syncStates.get(ingestedWarId);
    expect(syncStatus?.syncState).toBe('synced');
    expect(syncStatus?.lastSyncedAt).toBe(nowTime.toISOString());
  });

  it('second fetch with new attacks -> only new attacks added', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });

    gateway.currentWarResult = ok(mapWar(warMid1Fixture));
    const res1 = await ingest('#CLAN1');
    expect(res1.success).toBe(true);
    const warId = res1.success ? res1.value.warId! : '';

    gateway.currentWarResult = ok(mapWar(warMid2Fixture));
    const res2 = await ingest('#CLAN1');
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.value.status).toBe('synced');
      expect(res2.value.attacksAdded).toBe(2);
    }

    const storedWar = warRepo.wars.get(warId);
    const totalAttacks = storedWar?.clanMembers.reduce((sum, m) => sum + m.attacks.length, 0) || 0;
    expect(totalAttacks).toBe(2);
  });

  it('re-running the same fetch -> no changes (idempotent), still synced', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });

    gateway.currentWarResult = ok(mapWar(warMid1Fixture));
    const res1 = await ingest('#CLAN1');
    expect(res1.success).toBe(true);

    const res2 = await ingest('#CLAN1');
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.value.status).toBe('synced');
      expect(res2.value.attacksAdded).toBe(0);
    }
  });

  it('warEnded fetch -> final snapshot captured, war marked ended', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });

    gateway.currentWarResult = ok(mapWar(warMid1Fixture));
    await ingest('#CLAN1');

    gateway.currentWarResult = ok(mapWar(warEndedFixture));
    const res = await ingest('#CLAN1');
    expect(res.success).toBe(true);
    const warId = res.success ? res.value.warId! : '';

    const storedWar = warRepo.wars.get(warId);
    expect(storedWar?.state).toBe('warEnded');
  });

  it('gateway error (429/maintenance) -> Result failure, no state mutation, sync flagged out-of-sync', async () => {
    const ingest = makeIngestCurrentWar({ gateway, warRepo, attackRepo, now: nowFn });

    gateway.currentWarResult = ok(mapWar(warMid1Fixture));
    const res1 = await ingest('#CLAN1');
    const warId = res1.success ? res1.value.warId! : '';

    gateway.currentWarResult = err('Maintenance');

    nowTime = new Date('2026-06-14T20:15:00.000Z');

    const res2 = await ingest('#CLAN1');
    expect(res2.success).toBe(false);

    const syncStatus = warRepo.syncStates.get(warId);
    expect(syncStatus?.syncState).toBe('out-of-sync');
    expect(syncStatus?.lastSyncedAt).toBe(nowTime.toISOString());
  });
});
