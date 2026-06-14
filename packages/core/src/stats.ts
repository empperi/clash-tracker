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

/**
 * Computes attack-usage % = attacksDone / attacksAvailable * 100.
 *
 * Rules (documented once, reused across the stats domain):
 * - Divide-by-zero: when `attacksAvailable` is 0 (a player on no rosters, or a
 *   war with no available attacks) the result is `0` — never `NaN`/`Infinity`.
 * - Rounding: rounded to the nearest **integer** (`Math.round`). This keeps the
 *   metric consistent with the Acceptance Percentage Level slider, which moves in
 *   1% increments, so the `>=` qualification comparison and the ordering key both
 *   operate on the same integer percentage the user sees.
 */
export function attackUsagePct(input: {
  readonly attacksDone: number;
  readonly attacksAvailable: number;
}): number {
  if (input.attacksAvailable <= 0) {
    return 0;
  }
  return Math.round((input.attacksDone / input.attacksAvailable) * 100);
}
