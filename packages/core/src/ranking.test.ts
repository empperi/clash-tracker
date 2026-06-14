import { describe, it, expect } from 'vitest';
import { byKey, composeComparators, byClanRoleRank, rankPlayers, sortPlayers } from './ranking';
import type { Player, ClanRole, PlayerStats } from './domain';

// Build a player; `keys` overrides only the fields the comparator looks at.
function mk(
  id: string,
  keys: {
    usage?: number;
    wars?: number;
    stars?: number;
    defenses?: number;
    th?: number;
    role?: ClanRole;
  } = {}
): Player {
  const stats: PlayerStats = {
    warsParticipated: keys.wars ?? 5,
    attacksDone: 0,
    attacksAvailable: 0,
    attackUsagePct: keys.usage ?? 50,
    medianDestruction: 0,
    medianStars: keys.stars ?? 2,
    medianDefenses: keys.defenses ?? 1,
    medianOwnDestruction: 0,
    lastWarParticipatedAt: null,
  };
  return {
    tag: `#${id}`,
    name: id,
    role: keys.role ?? 'member',
    thLevel: keys.th ?? 10,
    inClan: true,
    stats,
  };
}

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

describe('byClanRoleRank', () => {
  it('orders Leader > Co-Leader > Elder > Member', () => {
    const players = [
      mk('m', { role: 'member' }),
      mk('l', { role: 'leader' }),
      mk('e', { role: 'elder' }),
      mk('c', { role: 'coLeader' }),
    ];
    const sorted = [...players].sort(byClanRoleRank);
    expect(sorted.map((p) => p.role)).toEqual(['leader', 'coLeader', 'elder', 'member']);
  });
});

describe('rankPlayers tie-break chain', () => {
  // Each case: A and B tie on every higher-priority key and differ only at the
  // named key, where A is the "better" value; A must sort before B (cmp < 0).
  const firstWins = (a: Player, b: Player) => {
    expect(rankPlayers(a, b)).toBeLessThan(0);
    expect(rankPlayers(b, a)).toBeGreaterThan(0);
  };

  it('1: attack-usage % decides first', () => {
    firstWins(mk('a', { usage: 80 }), mk('b', { usage: 79 }));
  });

  it('2: wars participated breaks an attack-usage tie', () => {
    firstWins(mk('a', { usage: 80, wars: 10 }), mk('b', { usage: 80, wars: 9 }));
  });

  it('3: median stars breaks a usage+wars tie', () => {
    firstWins(
      mk('a', { usage: 80, wars: 10, stars: 3 }),
      mk('b', { usage: 80, wars: 10, stars: 2 })
    );
  });

  it('4: median attacks-defended breaks the next tie', () => {
    firstWins(
      mk('a', { usage: 80, wars: 10, stars: 3, defenses: 4 }),
      mk('b', { usage: 80, wars: 10, stars: 3, defenses: 2 })
    );
  });

  it('5: TH level breaks the next tie', () => {
    firstWins(
      mk('a', { usage: 80, wars: 10, stars: 3, defenses: 4, th: 16 }),
      mk('b', { usage: 80, wars: 10, stars: 3, defenses: 4, th: 15 })
    );
  });

  it('6: clan role breaks the deepest tie (Leader over Member)', () => {
    firstWins(
      mk('a', { usage: 80, wars: 10, stars: 3, defenses: 4, th: 16, role: 'leader' }),
      mk('b', { usage: 80, wars: 10, stars: 3, defenses: 4, th: 16, role: 'member' })
    );
  });

  it('returns 0 for two players identical on every key', () => {
    const keys = { usage: 80, wars: 10, stars: 3, defenses: 4, th: 16, role: 'elder' as ClanRole };
    expect(rankPlayers(mk('a', keys), mk('b', keys))).toBe(0);
  });
});

describe('sortPlayers', () => {
  it('sorts a roster end-to-end by the full priority order', () => {
    const players = [mk('low', { usage: 40 }), mk('top', { usage: 95 }), mk('mid', { usage: 70 })];
    expect(sortPlayers(players).map((p) => p.name)).toEqual(['top', 'mid', 'low']);
  });

  it('does not mutate the input array', () => {
    const players = [mk('a', { usage: 10 }), mk('b', { usage: 90 })];
    const order = players.map((p) => p.name);
    sortPlayers(players);
    expect(players.map((p) => p.name)).toEqual(order);
  });

  it('is stable for fully-tied players (preserves input order)', () => {
    const keys = { usage: 80, wars: 5, stars: 2, defenses: 1, th: 10, role: 'member' as ClanRole };
    const players = [mk('first', keys), mk('second', keys), mk('third', keys)];
    expect(sortPlayers(players).map((p) => p.name)).toEqual(['first', 'second', 'third']);
  });

  it('returns an empty array for an empty roster', () => {
    expect(sortPlayers([])).toEqual([]);
  });
});
