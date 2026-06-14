import { describe, it, expect } from 'vitest';
import { aggregatePlayerStats } from './player-stats';
import type { PlayerWarRecord } from './domain';

describe('aggregatePlayerStats', () => {
  it('returns neutral zeros and null timestamp for no wars', () => {
    const stats = aggregatePlayerStats([]);
    expect(stats).toEqual({
      warsParticipated: 0,
      attacksDone: 0,
      attacksAvailable: 0,
      attackUsagePct: 0,
      medianDestruction: 0,
      medianStars: 0,
      medianDefenses: 0,
      medianOwnDestruction: 0,
      lastWarParticipatedAt: null,
    });
  });

  it('aggregates a single fully-used war (hand-computed)', () => {
    const records: PlayerWarRecord[] = [
      {
        attacks: [
          { stars: 3, destructionPercent: 100 },
          { stars: 2, destructionPercent: 85 },
        ],
        attacksAvailable: 2,
        defenses: [{ destructionPercent: 85 }, { destructionPercent: 50 }],
        warEndTime: '2026-06-16T10:00:00.000Z',
      },
    ];

    expect(aggregatePlayerStats(records)).toEqual({
      warsParticipated: 1,
      attacksDone: 2,
      attacksAvailable: 2,
      attackUsagePct: 100,
      medianDestruction: 92.5, // median(100, 85)
      medianStars: 2.5, // median(3, 2)
      medianDefenses: 2, // median([2])
      medianOwnDestruction: 85, // median([max(85, 50)])
      lastWarParticipatedAt: '2026-06-16T10:00:00.000Z',
    });
  });

  it('aggregates multiple wars with missed attacks (hand-computed)', () => {
    const records: PlayerWarRecord[] = [
      {
        attacks: [{ stars: 3, destructionPercent: 100 }],
        attacksAvailable: 2,
        defenses: [{ destructionPercent: 70 }],
        warEndTime: '2026-06-10T10:00:00.000Z',
      },
      {
        // missed both attacks
        attacks: [],
        attacksAvailable: 2,
        defenses: [],
        warEndTime: '2026-06-12T10:00:00.000Z', // latest war, but not last in the array
      },
      {
        attacks: [
          { stars: 2, destructionPercent: 60 },
          { stars: 1, destructionPercent: 40 },
        ],
        attacksAvailable: 2,
        defenses: [
          { destructionPercent: 90 },
          { destructionPercent: 30 },
          { destructionPercent: 100 },
        ],
        warEndTime: '2026-06-11T10:00:00.000Z',
      },
    ];

    expect(aggregatePlayerStats(records)).toEqual({
      warsParticipated: 3,
      attacksDone: 3, // 1 + 0 + 2
      attacksAvailable: 6, // 2 + 2 + 2
      attackUsagePct: 50, // round(3/6*100)
      medianDestruction: 60, // median(100, 60, 40)
      medianStars: 2, // median(3, 2, 1)
      medianDefenses: 1, // median([1, 0, 3]) -> sorted [0,1,3]
      medianOwnDestruction: 70, // median([70, 0, 100]) -> sorted [0,70,100]
      lastWarParticipatedAt: '2026-06-12T10:00:00.000Z', // max, not last
    });
  });

  it('handles a player who never attacked across all wars', () => {
    const records: PlayerWarRecord[] = [
      {
        attacks: [],
        attacksAvailable: 2,
        defenses: [{ destructionPercent: 50 }],
        warEndTime: '2026-06-10T10:00:00.000Z',
      },
      {
        attacks: [],
        attacksAvailable: 2,
        defenses: [{ destructionPercent: 80 }],
        warEndTime: '2026-06-11T10:00:00.000Z',
      },
    ];

    const stats = aggregatePlayerStats(records);
    expect(stats.attacksDone).toBe(0);
    expect(stats.attackUsagePct).toBe(0);
    expect(stats.medianDestruction).toBe(0); // no attacks -> median([]) = 0
    expect(stats.medianStars).toBe(0);
    expect(stats.warsParticipated).toBe(2);
  });

  it('handles a player who was never defended against', () => {
    const records: PlayerWarRecord[] = [
      {
        attacks: [{ stars: 3, destructionPercent: 100 }],
        attacksAvailable: 1,
        defenses: [],
        warEndTime: '2026-06-10T10:00:00.000Z',
      },
    ];

    const stats = aggregatePlayerStats(records);
    expect(stats.medianDefenses).toBe(0);
    expect(stats.medianOwnDestruction).toBe(0);
  });

  it('does not mutate the input records', () => {
    const records: PlayerWarRecord[] = [
      {
        attacks: [{ stars: 1, destructionPercent: 10 }],
        attacksAvailable: 2,
        defenses: [{ destructionPercent: 5 }],
        warEndTime: '2026-06-10T10:00:00.000Z',
      },
    ];
    const snapshot = JSON.stringify(records);
    aggregatePlayerStats(records);
    expect(JSON.stringify(records)).toBe(snapshot);
  });
});
