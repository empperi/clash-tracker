import { describe, it, expect } from 'vitest';
import { mapWar } from './mappers';
import { diffWar, computeSyncState, updateSyncStatus } from './ingestion';

import warPrepFixture from './fixtures/war_prep.json';
import warMid1Fixture from './fixtures/war_inWar.json';
import warMid2Fixture from './fixtures/war_mid2.json';
import warEndedFixture from './fixtures/war_ended_final.json';
import warNotInWarFixture from './fixtures/war_notInWar.json';

describe('diffWar', () => {
  const prepWar = mapWar(warPrepFixture);
  const mid1War = mapWar(warMid1Fixture);
  const mid2War = mapWar(warMid2Fixture);
  const endedWar = mapWar(warEndedFixture);

  it('should handle initial ingestion (stored = null)', () => {
    const diff = diffWar(null, prepWar);

    expect(diff.warHeader).not.toBeNull();
    expect(diff.warHeader?.state).toBe('preparation');
    expect(diff.warHeader?.teamSize).toBe(2);
    expect(diff.memberUpdates.length).toBe(2);
    expect(diff.attacksToAdd.length).toBe(0);
  });

  it('should return a no-op diff when fetched war is in notInWar state', () => {
    const notInWar = mapWar(warNotInWarFixture);
    const diff = diffWar(null, notInWar);

    expect(diff.warHeader).toBeNull();
    expect(diff.memberUpdates.length).toBe(0);
    expect(diff.attacksToAdd.length).toBe(0);
  });

  it('should yield empty changes when fetched war is identical to stored', () => {
    const diff = diffWar(mid1War, mid1War);

    expect(diff.warHeader).toBeNull();
    expect(diff.memberUpdates.length).toBe(0);
    expect(diff.attacksToAdd.length).toBe(0);
  });

  it('should yield only new attacks and updated members during mid-war progression', () => {
    // mid1 has 2 attacks total. mid2 has 4 attacks total (2 new).
    const diff = diffWar(mid1War, mid2War);

    expect(diff.warHeader).toBeNull(); // state remains inWar
    // 2 new attacks
    expect(diff.attacksToAdd.length).toBe(2);
    expect(diff.attacksToAdd.map((a) => a.order)).toContain(3);
    expect(diff.attacksToAdd.map((a) => a.order)).toContain(4);

    // Both clan members had updates (coleader got their first attack, leader got defended against/extra stats)
    expect(diff.memberUpdates.length).toBe(2);
  });

  it('should yield state change header when war transition to ended occurs', () => {
    // mid2 is inWar, endedWar is warEnded with the same attacks
    const diff = diffWar(mid2War, endedWar);

    expect(diff.warHeader).not.toBeNull();
    expect(diff.warHeader?.state).toBe('warEnded');
    expect(diff.attacksToAdd.length).toBe(0);
    expect(diff.memberUpdates.length).toBe(0);
  });

  it('should be idempotent (re-applying a diff to updated state yields nothing)', () => {
    // 1. Initial diff from mid1 to mid2
    const diff = diffWar(mid1War, mid2War);
    expect(diff.attacksToAdd.length).toBe(2);

    // 2. Simulate stored state updated with the diff:
    // We construct the updated stored state by merging the diff into mid1War
    const updatedStored = {
      ...mid1War,
      clanMembers: mid1War.clanMembers.map((m) => {
        const update = diff.memberUpdates.find((u) => u.tag === m.tag);
        return update || m;
      }),
      opponentMembers: mid2War.opponentMembers, // opponent members are also updated
    };

    // 3. Diff updatedStored against mid2War again
    const secondDiff = diffWar(updatedStored, mid2War);

    expect(secondDiff.warHeader).toBeNull();
    expect(secondDiff.attacksToAdd.length).toBe(0);
    expect(secondDiff.memberUpdates.length).toBe(0);
  });
});

describe('computeSyncState', () => {
  const mid1War = mapWar(warMid1Fixture);
  const mid2War = mapWar(warMid2Fixture);

  it('should return synced if stored matches fetched', () => {
    expect(computeSyncState(mid1War, mid1War)).toBe('synced');
  });

  it('should return out-of-sync if there are differences', () => {
    expect(computeSyncState(mid1War, mid2War)).toBe('out-of-sync');
  });
});

describe('updateSyncStatus', () => {
  it('should format sync state and set lastSyncedAt using the injected date', () => {
    const now = new Date('2026-06-14T20:00:00.000Z');
    const result = updateSyncStatus('synced', now);
    expect(result).toEqual({
      syncState: 'synced',
      lastSyncedAt: '2026-06-14T20:00:00.000Z',
    });
  });
});
