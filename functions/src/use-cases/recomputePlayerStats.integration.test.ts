import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ok, MappedMember, WarHeader, MappedWarMember, MappedAttack } from '@clash-tracker/core';
import { WarRepository } from '../repositories/WarRepository';
import { AttackRepository } from '../repositories/AttackRepository';
import { PlayerRepository } from '../repositories/PlayerRepository';
import { makeRecomputePlayerStats } from './recomputePlayerStats';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-recompute' }) : getApp();
const db = getFirestore(app);

const warId = 'recompute-war-1';

describe('makeRecomputePlayerStats integration', () => {
  const warRepo = new WarRepository(db);
  const attackRepo = new AttackRepository(db);
  const playerRepo = new PlayerRepository(db);

  const cleanup = async () => {
    const warDoc = db.doc(`wars/${warId}`);
    for (const sub of ['members', 'attacks']) {
      const snap = await warDoc.collection(sub).get();
      for (const d of snap.docs) await d.ref.delete();
    }
    await warDoc.delete();
    const players = await db.collection('players').get();
    for (const d of players.docs) await d.ref.delete();
  };

  beforeEach(cleanup);
  afterEach(cleanup);

  const seedWar = async () => {
    const header: WarHeader = {
      state: 'warEnded',
      teamSize: 2,
      opponentName: 'Opponent',
      opponentTag: '#OPP',
      startTime: '2026-06-11T10:00:00.000Z',
      endTime: '2026-06-12T10:00:00.000Z',
      preparationStartTime: '2026-06-10T10:00:00.000Z',
    };
    await warRepo.saveWarHeader(warId, header);

    const clan: MappedWarMember[] = [
      { tag: '#A', name: 'Alpha', townHallLevel: 16, mapPosition: 1, attacks: [], defenses: [] },
      { tag: '#B', name: 'Bravo', townHallLevel: 15, mapPosition: 2, attacks: [], defenses: [] },
    ];
    const opp: MappedWarMember[] = [
      { tag: '#OPP1', name: 'Op1', townHallLevel: 16, mapPosition: 1, attacks: [], defenses: [] },
    ];
    await warRepo.upsertMembers(warId, clan, false);
    await warRepo.upsertMembers(warId, opp, true);

    const attacks: MappedAttack[] = [
      { attackerTag: '#A', defenderTag: '#OPP1', stars: 3, destructionPercent: 100, order: 1 },
      { attackerTag: '#OPP1', defenderTag: '#B', stars: 2, destructionPercent: 85, order: 2 },
    ];
    await attackRepo.addAttacks(warId, attacks);
  };

  // #A is still in the clan; #B has left.
  const currentMembers: MappedMember[] = [
    { tag: '#A', name: 'Alpha', role: 'leader', thLevel: 16 },
  ];
  const clanRepo = { getCurrentMembers: async () => ok(currentMembers) };

  it('persists current and past player aggregates end-to-end', async () => {
    await seedWar();

    const recompute = makeRecomputePlayerStats({ warRepo, clanRepo, playerRepo });
    const result = await recompute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ playersUpserted: 2, current: 1, past: 1 });
    }

    const currentRes = await playerRepo.getCurrentPlayers();
    expect(currentRes.success).toBe(true);
    if (currentRes.success) {
      expect(currentRes.value).toHaveLength(1);
      const a = currentRes.value[0]!;
      expect(a.tag).toBe('#A');
      expect(a.inClan).toBe(true);
      expect(a.role).toBe('leader');
      expect(a.stats.attacksDone).toBe(1);
      expect(a.stats.attackUsagePct).toBe(50); // 1 of 2 classic attacks
      expect(a.stats.medianStars).toBe(3);
      expect(a.stats.medianDestruction).toBe(100);
    }

    const pastRes = await playerRepo.getPastPlayers();
    expect(pastRes.success).toBe(true);
    if (pastRes.success) {
      expect(pastRes.value).toHaveLength(1);
      const b = pastRes.value[0]!;
      expect(b.tag).toBe('#B');
      expect(b.inClan).toBe(false);
      expect(b.thLevel).toBe(15); // from their last war
      expect(b.stats.medianDefenses).toBe(1);
      expect(b.stats.medianOwnDestruction).toBe(85);
      expect(b.stats.lastWarParticipatedAt).toBe('2026-06-12T10:00:00.000Z');
    }
  });

  it('is idempotent: re-running does not duplicate players', async () => {
    await seedWar();
    const recompute = makeRecomputePlayerStats({ warRepo, clanRepo, playerRepo });
    await recompute();
    await recompute();

    const all = await db.collection('players').get();
    expect(all.size).toBe(2);
  });
});
