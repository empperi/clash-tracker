import { describe, expect, it } from 'vitest';
import { clanRoleRank } from './domain';

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
