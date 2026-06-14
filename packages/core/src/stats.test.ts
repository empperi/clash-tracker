import { describe, it, expect } from 'vitest';
import { median, attackUsagePct } from './stats';

describe('median', () => {
  it('returns 0 for an empty array (documented divide-by-nothing rule)', () => {
    expect(median([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(median([42])).toBe(42);
  });

  it('returns the middle value for an odd-length array', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('returns the average of the two middle values for an even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('sorts numerically, not lexicographically', () => {
    // Lexicographic sort would order [1, 10, 2, 20, 3] and pick 2.
    expect(median([20, 3, 1, 10, 2])).toBe(3);
  });

  it('handles negative and decimal values', () => {
    expect(median([-5, -1, -3])).toBe(-3);
    expect(median([1.5, 2.5])).toBe(2);
  });

  it('does not mutate the input array', () => {
    const input = [5, 2, 8, 1];
    const snapshot = [...input];
    median(input);
    expect(input).toEqual(snapshot);
  });
});

describe('attackUsagePct', () => {
  it('returns 0 when no attacks are available (documented divide-by-zero rule)', () => {
    expect(attackUsagePct({ attacksDone: 0, attacksAvailable: 0 })).toBe(0);
  });

  it('returns 0 when none of the available attacks were used', () => {
    expect(attackUsagePct({ attacksDone: 0, attacksAvailable: 14 })).toBe(0);
  });

  it('returns 100 when every available attack was used', () => {
    expect(attackUsagePct({ attacksDone: 14, attacksAvailable: 14 })).toBe(100);
  });

  it('computes a simple percentage', () => {
    expect(attackUsagePct({ attacksDone: 7, attacksAvailable: 14 })).toBe(50);
  });

  it('rounds to the nearest integer (consistent with the 1% slider)', () => {
    expect(attackUsagePct({ attacksDone: 1, attacksAvailable: 3 })).toBe(33); // 33.33 -> 33
    expect(attackUsagePct({ attacksDone: 2, attacksAvailable: 3 })).toBe(67); // 66.67 -> 67
    expect(attackUsagePct({ attacksDone: 5, attacksAvailable: 8 })).toBe(63); // 62.5 -> 63
  });
});
