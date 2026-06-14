import { describe, it, expect } from 'vitest';
import { byKey, composeComparators } from './ranking';

describe('byKey', () => {
  const items = [{ n: 3 }, { n: 1 }, { n: 2 }];

  it('sorts ascending by default', () => {
    const sorted = [...items].sort(byKey((i) => i.n));
    expect(sorted.map((i) => i.n)).toEqual([1, 2, 3]);
  });

  it('sorts descending when asked', () => {
    const sorted = [...items].sort(byKey((i) => i.n, 'desc'));
    expect(sorted.map((i) => i.n)).toEqual([3, 2, 1]);
  });

  it('returns 0 for equal keys', () => {
    expect(byKey((i: { n: number }) => i.n)({ n: 5 }, { n: 5 })).toBe(0);
  });
});

describe('composeComparators', () => {
  type Row = { a: number; b: number };
  const cmp = composeComparators<Row>(
    byKey((r) => r.a, 'desc'),
    byKey((r) => r.b, 'desc')
  );

  it('uses the first comparator when it is decisive', () => {
    expect(cmp({ a: 2, b: 1 }, { a: 1, b: 9 })).toBeLessThan(0); // a decides, first sorts earlier
  });

  it('falls through to the next comparator on a tie', () => {
    expect(cmp({ a: 1, b: 2 }, { a: 1, b: 1 })).toBeLessThan(0); // a tied, b decides
  });

  it('returns 0 when every comparator ties', () => {
    expect(cmp({ a: 1, b: 1 }, { a: 1, b: 1 })).toBe(0);
  });

  it('returns 0 with no comparators', () => {
    expect(composeComparators<Row>()({ a: 1, b: 2 }, { a: 3, b: 4 })).toBe(0);
  });
});
