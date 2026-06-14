import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WarRepository } from './WarRepository';
import { WarHeader } from '@clash-tracker/core';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
const db = getFirestore(app);

describe('WarRepository', () => {
  const repo = new WarRepository(db);
  const warId = 'test-war-123';
  const warDocRef = db.doc(`wars/${warId}`);

  beforeEach(async () => {
    // Cleanup war document and members subcollection
    await warDocRef.delete();
    const membersSnap = await warDocRef.collection('members').get();
    for (const doc of membersSnap.docs) {
      await doc.ref.delete();
    }
  });

  afterEach(async () => {
    await warDocRef.delete();
    const membersSnap = await warDocRef.collection('members').get();
    for (const doc of membersSnap.docs) {
      await doc.ref.delete();
    }
  });

  it('should save war header and get it back', async () => {
    const header: WarHeader = {
      state: 'inWar',
      teamSize: 2,
      opponentName: 'Opponent Clan',
      opponentTag: '#OPPONENT1',
      startTime: '2026-06-15T10:00:00.000Z',
      endTime: '2026-06-16T10:00:00.000Z',
      preparationStartTime: '2026-06-14T10:00:00.000Z',
    };

    await repo.saveWarHeader(warId, header);

    const storedWar = await repo.getWar(warId);
    expect(storedWar).not.toBeNull();
    if (storedWar) {
      expect(storedWar.state).toBe('inWar');
      expect(storedWar.teamSize).toBe(2);
      expect(storedWar.opponentName).toBe('Opponent Clan');
      expect(storedWar.opponentTag).toBe('#OPPONENT1');
      expect(storedWar.startTime).toBe('2026-06-15T10:00:00.000Z');
      expect(storedWar.endTime).toBe('2026-06-16T10:00:00.000Z');
      expect(storedWar.preparationStartTime).toBe('2026-06-14T10:00:00.000Z');
      expect(storedWar.clanMembers.length).toBe(0);
      expect(storedWar.opponentMembers.length).toBe(0);
    }
  });

  it('should save and upsert members (clan vs opponent)', async () => {
    const header: WarHeader = {
      state: 'inWar',
      teamSize: 2,
      opponentName: 'Opponent Clan',
      opponentTag: '#OPPONENT1',
      startTime: '2026-06-15T10:00:00.000Z',
      endTime: '2026-06-16T10:00:00.000Z',
      preparationStartTime: '2026-06-14T10:00:00.000Z',
    };
    await repo.saveWarHeader(warId, header);

    const clanMembers = [
      { tag: '#M1', name: 'ClanPlayer1', townHallLevel: 16, mapPosition: 1, attacks: [], defenses: [] },
    ];
    const opponentMembers = [
      { tag: '#O1', name: 'OpponentPlayer1', townHallLevel: 16, mapPosition: 1, attacks: [], defenses: [] },
    ];

    await repo.upsertMembers(warId, clanMembers, false);
    await repo.upsertMembers(warId, opponentMembers, true);

    const storedWar = await repo.getWar(warId);
    expect(storedWar).not.toBeNull();
    if (storedWar) {
      expect(storedWar.clanMembers.length).toBe(1);
      expect(storedWar.clanMembers[0].name).toBe('ClanPlayer1');
      expect(storedWar.opponentMembers.length).toBe(1);
      expect(storedWar.opponentMembers[0].name).toBe('OpponentPlayer1');
    }
  });
});
