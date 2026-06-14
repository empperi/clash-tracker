/**
 * Composable comparators for player ordering. The order is declared as a list
 * of (key-extractor, direction) pairs and composed left-to-right, so each key
 * only breaks ties left by the previous one (see `rankPlayers`).
 */

import { clanRoleRank } from './domain';
import type { Player } from './domain';

export type Comparator<T> = (a: T, b: T) => number;
export type Direction = 'asc' | 'desc';

/**
 * Builds a comparator from a numeric key-extractor. `'asc'` sorts smaller-first,
 * `'desc'` sorts larger-first. Equal keys compare as 0 (so composition can fall
 * through to the next key).
 */
export function byKey<T>(
  extract: (item: T) => number,
  direction: Direction = 'asc'
): Comparator<T> {
  return (a, b) => {
    const diff = extract(a) - extract(b);
    return direction === 'asc' ? diff : -diff;
  };
}

/**
 * Composes comparators into one that applies them in order, returning the first
 * non-zero result. With no comparators (or when all tie) it returns 0, leaving
 * the relative order to the (stable) sort.
 */
export function composeComparators<T>(...comparators: readonly Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const cmp of comparators) {
      const result = cmp(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };
}

/** Orders players by clan role: Leader > Co-Leader > Elder > Member. */
export const byClanRoleRank: Comparator<Pick<Player, 'role'>> = byKey(
  (p) => clanRoleRank(p.role),
  'desc'
);

/**
 * The product's six-key player ordering (both lists), in priority order
 * (all descending), per `product.md`:
 *   1. attack-usage %  2. wars participated  3. median stars
 *   4. median attacks-defended  5. TH level  6. clan role.
 * Ties beyond role are left to the (stable) sort — see `sortPlayers`.
 */
export const rankPlayers: Comparator<Player> = composeComparators<Player>(
  byKey((p) => p.stats.attackUsagePct, 'desc'),
  byKey((p) => p.stats.warsParticipated, 'desc'),
  byKey((p) => p.stats.medianStars, 'desc'),
  byKey((p) => p.stats.medianDefenses, 'desc'),
  byKey((p) => p.thLevel, 'desc'),
  byClanRoleRank
);
