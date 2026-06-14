import { describe, expect, it } from 'vitest';
import { clanRoleRank } from './domain';
import type { PlayerWarRecord, PlayerStats } from './domain';

describe('clanRoleRank', () => {
  it('correctly orders clan roles', () => {
    expect(clanRoleRank('leader')).toBe(4);
    expect(clanRoleRank('coLeader')).toBe(3);
    expect(clanRoleRank('elder')).toBe(2);
    expect(clanRoleRank('member')).toBe(1);
  });

  it('correctly ranks in decreasing order', () => {
    expect(clanRoleRank('leader')).toBeGreaterThan(clanRoleRank('coLeader'));
    expect(clanRoleRank('coLeader')).toBeGreaterThan(clanRoleRank('elder'));
    expect(clanRoleRank('elder')).toBeGreaterThan(clanRoleRank('member'));
  });

  it('handles invalid roles at runtime', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(clanRoleRank('invalid-role' as any)).toBe('invalid-role' as any);
  });
});

describe('player stats types', () => {
  it('PlayerWarRecord and PlayerStats have the expected shape', () => {
    const record: PlayerWarRecord = {
      attacks: [{ stars: 3, destructionPercent: 100 }],
      attacksAvailable: 2,
      defenses: [{ destructionPercent: 85 }],
      warEndTime: '2026-06-16T10:00:00.000Z',
    };

    const stats: PlayerStats = {
      warsParticipated: 1,
      attacksDone: 1,
      attacksAvailable: 2,
      attackUsagePct: 50,
      medianDestruction: 100,
      medianStars: 3,
      medianDefenses: 1,
      medianOwnDestruction: 85,
      lastWarParticipatedAt: '2026-06-16T10:00:00.000Z',
    };

    expect(record.attacks).toHaveLength(1);
    expect(stats.lastWarParticipatedAt).toBe(record.warEndTime);
  });
});
