import {
  Result,
  ok,
  err,
  Player,
  PlayerWarRecord,
  MappedWar,
  MappedMember,
  aggregatePlayerStats,
} from '@clash-tracker/core';

/**
 * Attacks each member gets in a classic war. CWL wars give 1 attack/member;
 * that is Track 9's concern. The stored war doesn't carry attacks-per-member, so
 * we assume the classic value here.
 * TODO(question): when CWL ingestion lands, derive this from the war type.
 */
const CLASSIC_ATTACKS_PER_MEMBER = 2;

export interface RecomputeSummary {
  readonly playersUpserted: number;
  readonly current: number;
  readonly past: number;
}

export interface RecomputePlayerStatsDeps {
  readonly warRepo: {
    readonly listWars: () => Promise<Result<readonly MappedWar[], string>>;
  };
  readonly clanRepo: {
    readonly getCurrentMembers: () => Promise<Result<readonly MappedMember[], string>>;
  };
  readonly playerRepo: {
    readonly upsertPlayer: (player: Player) => Promise<Result<void, string>>;
  };
}

/**
 * Builds the recompute use case: load every tracked war and the current clan
 * roster, aggregate per-player stats via the pure `@clash-tracker/core`
 * functions, and upsert `players/*`. Players still in the clan are written
 * `inClan=true` with identity from the latest roster; players who have left are
 * retained as `inClan=false` with identity from their most recent war.
 *
 * On any read failure nothing is written; an upsert failure aborts and is
 * surfaced (partial writes already applied are left for the next run, which is
 * idempotent because stats are fully recomputed each time).
 */
export function makeRecomputePlayerStats(deps: RecomputePlayerStatsDeps) {
  const { warRepo, clanRepo, playerRepo } = deps;

  return async (): Promise<Result<RecomputeSummary, string>> => {
    const warsResult = await warRepo.listWars();
    if (!warsResult.success) {
      return err(`Failed to load wars: ${warsResult.error}`);
    }
    const membersResult = await clanRepo.getCurrentMembers();
    if (!membersResult.success) {
      return err(`Failed to load clan members: ${membersResult.error}`);
    }

    const recordsByTag = new Map<string, PlayerWarRecord[]>();
    const lastWarIdentity = new Map<string, { name: string; thLevel: number; endTime: string }>();

    for (const war of warsResult.value) {
      for (const m of war.clanMembers) {
        const record: PlayerWarRecord = {
          attacks: m.attacks.map((a) => ({
            stars: a.stars,
            destructionPercent: a.destructionPercent,
          })),
          attacksAvailable: CLASSIC_ATTACKS_PER_MEMBER,
          defenses: m.defenses.map((d) => ({ destructionPercent: d.destructionPercent })),
          warEndTime: war.endTime,
        };
        const list = recordsByTag.get(m.tag) ?? [];
        list.push(record);
        recordsByTag.set(m.tag, list);

        const prev = lastWarIdentity.get(m.tag);
        if (!prev || war.endTime > prev.endTime) {
          lastWarIdentity.set(m.tag, {
            name: m.name,
            thLevel: m.townHallLevel,
            endTime: war.endTime,
          });
        }
      }
    }

    const currentByTag = new Map(membersResult.value.map((m) => [m.tag, m]));
    const allTags = new Set<string>([...recordsByTag.keys(), ...currentByTag.keys()]);

    let current = 0;
    let past = 0;
    for (const tag of allTags) {
      const stats = aggregatePlayerStats(recordsByTag.get(tag) ?? []);
      const member = currentByTag.get(tag);

      let player: Player;
      if (member) {
        current += 1;
        player = {
          tag,
          name: member.name,
          role: member.role,
          thLevel: member.thLevel,
          inClan: true,
          stats,
        };
      } else {
        past += 1;
        const identity = lastWarIdentity.get(tag);
        player = {
          tag,
          name: identity?.name ?? '',
          role: 'member',
          thLevel: identity?.thLevel ?? 0,
          inClan: false,
          stats,
        };
      }

      const upsertResult = await playerRepo.upsertPlayer(player);
      if (!upsertResult.success) {
        return err(`Failed to upsert player ${tag}: ${upsertResult.error}`);
      }
    }

    return ok({ playersUpserted: current + past, current, past });
  };
}
