import { describe, it, expect } from 'vitest';
import {
  Result,
  ok,
  err,
  Player,
  MappedWar,
  MappedWarMember,
  MappedAttack,
  MappedMember,
} from '@clash-tracker/core';
import { makeRecomputePlayerStats } from './recomputePlayerStats';

const atk = (stars: number, destructionPercent: number): MappedAttack => ({
  attackerTag: '',
  defenderTag: '',
  stars,
  destructionPercent,
  order: 0,
});

const member = (
  tag: string,
  attacks: MappedAttack[],
  defenses: MappedAttack[],
  thLevel = 15
): MappedWarMember => ({
  tag,
  name: tag.replace('#', ''),
  townHallLevel: thLevel,
  mapPosition: 1,
  attacks,
  defenses,
});

const war = (endTime: string, clanMembers: MappedWarMember[]): MappedWar => ({
  state: 'warEnded',
  teamSize: clanMembers.length,
  opponentName: 'Opp',
  opponentTag: '#OPP',
  startTime: '2026-06-15T10:00:00.000Z',
  endTime,
  preparationStartTime: '2026-06-14T10:00:00.000Z',
  clanMembers,
  opponentMembers: [],
});

const clanMember = (tag: string, over: Partial<MappedMember> = {}): MappedMember => ({
  tag,
  name: tag.replace('#', ''),
  role: 'member',
  thLevel: 15,
  ...over,
});

// Configurable in-memory deps (real implementations, not mocks).
function makeDeps(opts: {
  wars?: Result<readonly MappedWar[], string>;
  members?: Result<readonly MappedMember[], string>;
  upsert?: (p: Player) => Promise<Result<void, string>>;
}) {
  const upserted: Player[] = [];
  const deps = {
    warRepo: { listWars: async () => opts.wars ?? ok([]) },
    clanRepo: { getCurrentMembers: async () => opts.members ?? ok([]) },
    playerRepo: {
      upsertPlayer:
        opts.upsert ??
        (async (p: Player) => {
          upserted.push(p);
          return ok(undefined);
        }),
    },
  };
  return { deps, upserted };
}

describe('makeRecomputePlayerStats', () => {
  it('aggregates a current member across wars and marks them inClan=true', async () => {
    const wars = [
      war('2026-06-10T10:00:00.000Z', [member('#A', [atk(3, 100)], [], 16)]),
      war('2026-06-12T10:00:00.000Z', [member('#A', [atk(1, 40)], [atk(2, 80)], 16)]),
    ];
    const { deps, upserted } = makeDeps({
      wars: ok(wars),
      members: ok([clanMember('#A', { role: 'leader', thLevel: 16, name: 'Alpha' })]),
    });

    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(true);

    expect(upserted).toHaveLength(1);
    const a = upserted[0]!;
    expect(a.tag).toBe('#A');
    expect(a.name).toBe('Alpha'); // identity from current clan list
    expect(a.role).toBe('leader');
    expect(a.inClan).toBe(true);
    expect(a.stats.warsParticipated).toBe(2);
    expect(a.stats.attacksDone).toBe(2);
    expect(a.stats.attacksAvailable).toBe(4); // 2 wars * 2 classic attacks
    expect(a.stats.attackUsagePct).toBe(50);
    expect(a.stats.lastWarParticipatedAt).toBe('2026-06-12T10:00:00.000Z');
  });

  it('retains a player who left the clan as inClan=false with identity from their last war', async () => {
    const wars = [war('2026-06-09T10:00:00.000Z', [member('#GONE', [atk(2, 60)], [], 13)])];
    const { deps, upserted } = makeDeps({
      wars: ok(wars),
      members: ok([]), // not in the current roster anymore
    });

    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(true);

    expect(upserted).toHaveLength(1);
    const gone = upserted[0]!;
    expect(gone.tag).toBe('#GONE');
    expect(gone.inClan).toBe(false);
    expect(gone.thLevel).toBe(13); // from their last war
    expect(gone.stats.warsParticipated).toBe(1);
  });

  it('upserts a current member with no war history as zero stats, inClan=true', async () => {
    const { deps, upserted } = makeDeps({
      wars: ok([]),
      members: ok([clanMember('#NEW')]),
    });

    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(true);
    expect(upserted).toHaveLength(1);
    expect(upserted[0]!.inClan).toBe(true);
    expect(upserted[0]!.stats.warsParticipated).toBe(0);
    expect(upserted[0]!.stats.lastWarParticipatedAt).toBeNull();
  });

  it('reports a summary of current vs past players upserted', async () => {
    const wars = [
      war('2026-06-10T10:00:00.000Z', [member('#A', [atk(3, 100)], []), member('#LEFT', [], [])]),
    ];
    const { deps } = makeDeps({
      wars: ok(wars),
      members: ok([clanMember('#A')]),
    });

    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ playersUpserted: 2, current: 1, past: 1 });
    }
  });

  it('fails without upserting when listWars fails', async () => {
    const { deps, upserted } = makeDeps({
      wars: err('boom'),
      members: ok([clanMember('#A')]),
    });
    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(false);
    expect(upserted).toHaveLength(0);
  });

  it('fails without upserting when getCurrentMembers fails', async () => {
    const { deps, upserted } = makeDeps({
      wars: ok([]),
      members: err('no clan'),
    });
    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(false);
    expect(upserted).toHaveLength(0);
  });

  it('propagates an upsert failure', async () => {
    const { deps } = makeDeps({
      wars: ok([]),
      members: ok([clanMember('#A')]),
      upsert: async () => err('write failed'),
    });
    const result = await makeRecomputePlayerStats(deps)();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('write failed');
    }
  });
});
