/**
 * Computes the median of a list of numbers.
 *
 * Rules (documented once, reused across the stats domain):
 * - Empty input returns `0` (there is no meaningful median; `0` is the neutral
 *   value used everywhere a "no data" stat is displayed or compared).
 * - Odd length: the middle value of the numerically-sorted list.
 * - Even length: the arithmetic mean of the two middle values.
 *
 * The input array is never mutated (it is copied before sorting).
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}
