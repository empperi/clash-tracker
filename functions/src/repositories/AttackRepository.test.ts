import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { AttackRepository } from './AttackRepository';
import { MappedAttack } from '@clash-tracker/core';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-attack-repo' }) : getApp();
const db = getFirestore(app);

describe('AttackRepository', () => {
  const repo = new AttackRepository(db);
  const warId = 'test-war-attacks';
  const warDocRef = db.doc(`wars/${warId}`);

  const cleanup = async () => {
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

  it('should save and list attacks', async () => {
    const attacks: MappedAttack[] = [
      {
        attackerTag: '#A1',
        defenderTag: '#D1',
        stars: 3,
        destructionPercent: 100,
        order: 1,
      },
      {
        attackerTag: '#A2',
        defenderTag: '#D2',
        stars: 2,
        destructionPercent: 85,
        order: 2,
      },
    ];

    await repo.addAttacks(warId, attacks);

    const listed = await repo.listAttacks(warId);
    expect(listed).toHaveLength(2);

    const sorted = [...listed].sort((a, b) => a.order - b.order);
    expect(sorted[0]).toEqual(attacks[0]);
    expect(sorted[1]).toEqual(attacks[1]);
  });

  it('should be idempotent (adding duplicate attacks leaves one doc)', async () => {
    const attacks: MappedAttack[] = [
      {
        attackerTag: '#A1',
        defenderTag: '#D1',
        stars: 3,
        destructionPercent: 100,
        order: 1,
      },
    ];

    await repo.addAttacks(warId, attacks);
    await repo.addAttacks(warId, attacks);

    const listed = await repo.listAttacks(warId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(attacks[0]);
  });
});
