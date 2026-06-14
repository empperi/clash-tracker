import { describe, it, expect } from 'vitest';
import { median } from './stats';

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
