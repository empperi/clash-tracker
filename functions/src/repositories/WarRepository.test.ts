import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WarRepository } from './WarRepository';
import { AttackRepository } from './AttackRepository';
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
      {
        tag: '#M1',
        name: 'ClanPlayer1',
        townHallLevel: 16,
        mapPosition: 1,
        attacks: [],
        defenses: [],
      },
    ];
    const opponentMembers = [
      {
        tag: '#O1',
        name: 'OpponentPlayer1',
        townHallLevel: 16,
        mapPosition: 1,
        attacks: [],
        defenses: [],
      },
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

  it('should perform a full round-trip: header, members, attacks, and read back a complete MappedWar', async () => {
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
      {
        tag: '#M1',
        name: 'ClanPlayer1',
        townHallLevel: 16,
        mapPosition: 1,
        attacks: [],
        defenses: [],
      },
      {
        tag: '#M2',
        name: 'ClanPlayer2',
        townHallLevel: 15,
        mapPosition: 2,
        attacks: [],
        defenses: [],
      },
    ];
    const opponentMembers = [
      {
        tag: '#O1',
        name: 'OpponentPlayer1',
        townHallLevel: 16,
        mapPosition: 1,
        attacks: [],
        defenses: [],
      },
      {
        tag: '#O2',
        name: 'OpponentPlayer2',
        townHallLevel: 15,
        mapPosition: 2,
        attacks: [],
        defenses: [],
      },
    ];

    await repo.upsertMembers(warId, clanMembers, false);
    await repo.upsertMembers(warId, opponentMembers, true);

    const attackRepo = new AttackRepository(db);
    const attacks = [
      {
        attackerTag: '#M1',
        defenderTag: '#O2',
        stars: 3,
        destructionPercent: 100,
        order: 1,
      },
      {
        attackerTag: '#O1',
        defenderTag: '#M2',
        stars: 2,
        destructionPercent: 90,
        order: 2,
      },
      {
        attackerTag: '#M2',
        defenderTag: '#O1',
        stars: 1,
        destructionPercent: 50,
        order: 3,
      },
    ];
    await attackRepo.addAttacks(warId, attacks);

    const storedWar = await repo.getWar(warId);
    expect(storedWar).not.toBeNull();
    if (storedWar) {
      expect(storedWar.state).toBe('inWar');
      expect(storedWar.teamSize).toBe(2);

      const m1 = storedWar.clanMembers.find((m) => m.tag === '#M1');
      const m2 = storedWar.clanMembers.find((m) => m.tag === '#M2');
      const o1 = storedWar.opponentMembers.find((o) => o.tag === '#O1');
      const o2 = storedWar.opponentMembers.find((o) => o.tag === '#O2');

      expect(m1).toBeDefined();
      expect(m2).toBeDefined();
      expect(o1).toBeDefined();
      expect(o2).toBeDefined();

      if (m1 && m2 && o1 && o2) {
        // M1 attacked O2 (order 1)
        expect(m1.attacks).toHaveLength(1);
        expect(m1.attacks[0]).toEqual(attacks[0]);
        expect(m1.defenses).toHaveLength(0);

        // O1 attacked M2 (order 2)
        // M2 attacked O1 (order 3)
        expect(m2.attacks).toHaveLength(1);
        expect(m2.attacks[0]).toEqual(attacks[2]); // order 3
        expect(m2.defenses).toHaveLength(1);
        expect(m2.defenses[0]).toEqual(attacks[1]); // order 2

        expect(o1.attacks).toHaveLength(1);
        expect(o1.attacks[0]).toEqual(attacks[1]); // order 2
        expect(o1.defenses).toHaveLength(1);
        expect(o1.defenses[0]).toEqual(attacks[2]); // order 3

        expect(o2.attacks).toHaveLength(0);
        expect(o2.defenses).toHaveLength(1);
        expect(o2.defenses[0]).toEqual(attacks[0]); // order 1
      }
    }
  });
});
