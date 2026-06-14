import { describe, it, expect } from 'vitest';
import { splitByParticipation } from './eligibility';

// Minimal structural players for the split (only warsParticipated matters here).
const player = (id: string, warsParticipated: number) => ({
  id,
  stats: { warsParticipated },
});

describe('splitByParticipation', () => {
  it('puts a player with exactly the minimum into the qualified pool (>= semantics)', () => {
    const players = [player('a', 5)];
    const { qualifiedPool, notEnoughWars } = splitByParticipation(players, 5);
    expect(qualifiedPool.map((p) => p.id)).toEqual(['a']);
    expect(notEnoughWars).toEqual([]);
  });

  it('puts a player below the minimum into notEnoughWars', () => {
    const players = [player('a', 4)];
    const { qualifiedPool, notEnoughWars } = splitByParticipation(players, 5);
    expect(qualifiedPool).toEqual([]);
    expect(notEnoughWars.map((p) => p.id)).toEqual(['a']);
  });

  it('partitions a mixed roster and preserves input order within each group', () => {
    const players = [player('a', 10), player('b', 2), player('c', 5), player('d', 0)];
    const { qualifiedPool, notEnoughWars } = splitByParticipation(players, 5);
    expect(qualifiedPool.map((p) => p.id)).toEqual(['a', 'c']);
    expect(notEnoughWars.map((p) => p.id)).toEqual(['b', 'd']);
  });

  it('qualifies everyone when the minimum is 0', () => {
    const players = [player('a', 0), player('b', 3)];
    const { qualifiedPool, notEnoughWars } = splitByParticipation(players, 0);
    expect(qualifiedPool.map((p) => p.id)).toEqual(['a', 'b']);
    expect(notEnoughWars).toEqual([]);
  });

  it('returns two empty groups for an empty roster', () => {
    const { qualifiedPool, notEnoughWars } = splitByParticipation([], 5);
    expect(qualifiedPool).toEqual([]);
    expect(notEnoughWars).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const players = [player('a', 10), player('b', 2)];
    const snapshot = JSON.stringify(players);
    splitByParticipation(players, 5);
    expect(JSON.stringify(players)).toBe(snapshot);
  });
});
