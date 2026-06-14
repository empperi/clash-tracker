import type { PlayerWarRecord, PlayerStats } from './domain';
import { median, attackUsagePct } from './stats';

/**
 * Aggregates a player's per-war records into their overall `PlayerStats`.
 *
 * Pure: does not mutate the input. Conventions reused from `stats.ts`:
 * - medians over empty data return 0 (see `median`),
 * - attack-usage % handles available = 0 -> 0 and rounds to an integer.
 *
 * Per-war derivations:
 * - "attacks defended against" that war = number of defenses faced,
 * - "own-base destruction" that war = the worst (max) defense destruction %,
 *   or 0 if the player was never attacked.
 *
 * `lastWarParticipatedAt` is the maximum war end time (ISO-8601 strings compare
 * chronologically), or null when there are no records.
 */
export function aggregatePlayerStats(records: readonly PlayerWarRecord[]): PlayerStats {
  const attacksDone = records.reduce((sum, r) => sum + r.attacks.length, 0);
  const attacksAvailable = records.reduce((sum, r) => sum + r.attacksAvailable, 0);

  const allDestruction = records.flatMap((r) => r.attacks.map((a) => a.destructionPercent));
  const allStars = records.flatMap((r) => r.attacks.map((a) => a.stars));

  const defensesPerWar = records.map((r) => r.defenses.length);
  const ownDestructionPerWar = records.map((r) =>
    r.defenses.length === 0 ? 0 : Math.max(...r.defenses.map((d) => d.destructionPercent))
  );

  const lastWarParticipatedAt =
    records.length === 0
      ? null
      : records.reduce(
          (latest, r) => (r.warEndTime > latest ? r.warEndTime : latest),
          records[0]!.warEndTime
        );

  return {
    warsParticipated: records.length,
    attacksDone,
    attacksAvailable,
    attackUsagePct: attackUsagePct({ attacksDone, attacksAvailable }),
    medianDestruction: median(allDestruction),
    medianStars: median(allStars),
    medianDefenses: median(defensesPerWar),
    medianOwnDestruction: median(ownDestructionPerWar),
    lastWarParticipatedAt,
  };
}
