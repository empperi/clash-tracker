/**
 * Composable comparators for player ordering. The order is declared as a list
 * of (key-extractor, direction) pairs and composed left-to-right, so each key
 * only breaks ties left by the previous one (see `rankPlayers`).
 */

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
