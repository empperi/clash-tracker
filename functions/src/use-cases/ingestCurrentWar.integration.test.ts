import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WarRepository } from '../repositories/WarRepository';
import { AttackRepository } from '../repositories/AttackRepository';
import { makeIngestCurrentWar } from './ingestCurrentWar';
import { Result, ok, MappedWar, CocApiError, mapWar } from '@clash-tracker/core';

// Import JSON fixtures
import warInWarFixture from '../../../packages/core/src/fixtures/war_inWar.json';
import warMid2Fixture from '../../../packages/core/src/fixtures/war_mid2.json';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app =
  getApps().length === 0 ? initializeApp({ projectId: 'demo-ingest-integration' }) : getApp();
const db = getFirestore(app);

describe('makeIngestCurrentWar Integration Test with Firestore Emulator', () => {
  const warRepo = new WarRepository(db);
  const attackRepo = new AttackRepository(db);
  const clanTag = '#2PGQYPQ';
  const warId = '2PGQYPQ-OPPONENT-20260614T200000000Z'; // clean tag format ID
  const warDocRef = db.doc(`wars/${warId}`);

  const cleanup = async () => {
    await warDocRef.delete();
    const membersSnap = await warDocRef.collection('members').get();
    for (const doc of membersSnap.docs) {
      await doc.ref.delete();
    }
    const attacksSnap = await warDocRef.collection('attacks').get();
    for (const doc of attacksSnap.docs) {
      await doc.ref.delete();
    }
  };

  beforeEach(async () => {
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should run full ingestion lifecycle against the Firestore emulator', async () => {
    let currentWarResult: Result<MappedWar, CocApiError> = ok(mapWar(warInWarFixture));
    const fakeGateway = {
      getCurrentWar: async () => currentWarResult,
    };

    const nowTime = new Date('2026-06-14T20:00:00.000Z');
    const ingest = makeIngestCurrentWar({
      gateway: fakeGateway,
      warRepo,
      attackRepo,
      now: () => nowTime,
    });

    // 1. First Ingest (mid1 / war_inWar.json)
    const res1 = await ingest(clanTag);
    expect(res1.success).toBe(true);
    if (res1.success) {
      expect(res1.value.status).toBe('synced');
      expect(res1.value.attacksAdded).toBe(2);
    }

    // Verify stored data in emulator via WarRepository
    const stored1Result = await warRepo.getWar(res1.success ? res1.value.warId! : '');
    expect(stored1Result.success).toBe(true);
    if (stored1Result.success && stored1Result.value) {
      expect(stored1Result.value.state).toBe('inWar');
      const clanAttacks = stored1Result.value.clanMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      const opponentAttacks = stored1Result.value.opponentMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      expect(clanAttacks + opponentAttacks).toBe(2);
    }

    // 2. Second Ingest (mid2 / war_mid2.json)
    currentWarResult = ok(mapWar(warMid2Fixture));
    const res2 = await ingest(clanTag);
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.value.status).toBe('synced');
      expect(res2.value.attacksAdded).toBe(2); // 2 new attacks added
    }

    // Verify stored data in emulator
    const stored2Result = await warRepo.getWar(res1.success ? res1.value.warId! : '');
    expect(stored2Result.success).toBe(true);
    if (stored2Result.success && stored2Result.value) {
      const clanAttacks = stored2Result.value.clanMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      const opponentAttacks = stored2Result.value.opponentMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      expect(clanAttacks + opponentAttacks).toBe(4);
    }

    // 3. Re-run identical Ingest (idempotency check)
    const res3 = await ingest(clanTag);
    expect(res3.success).toBe(true);
    if (res3.success) {
      expect(res3.value.status).toBe('synced');
      expect(res3.value.attacksAdded).toBe(0); // 0 new attacks
    }

    // Verify no duplicates created
    const stored3Result = await warRepo.getWar(res1.success ? res1.value.warId! : '');
    expect(stored3Result.success).toBe(true);
    if (stored3Result.success && stored3Result.value) {
      const clanAttacks = stored3Result.value.clanMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      const opponentAttacks = stored3Result.value.opponentMembers.reduce(
        (sum, m) => sum + m.attacks.length,
        0
      );
      expect(clanAttacks + opponentAttacks).toBe(4);
    }
  });
});
