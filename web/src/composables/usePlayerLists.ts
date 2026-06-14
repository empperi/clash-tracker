import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import {
  splitByParticipation,
  markQualification,
  sortPlayers,
  type Player,
} from '@clash-tracker/core';
import type { Thresholds } from '../api/players';

/**
 * Derives the three ranked Player List groups from players + thresholds, using
 * the Track 4 pure functions (no domain rules re-implemented here). Reactive:
 * because thresholds are inputs, changing them re-splits instantly with no
 * refetch of raw stats.
 *
 * - `qualifiedAbove` / `qualifiedBelow`: List 1 (warsParticipated >= min),
 *   partitioned by the acceptance line, each ranked by the six-key comparator.
 * - `notEnoughWars`: List 2 (below the minimum), ranked the same way.
 */
export function usePlayerLists(
  players: MaybeRefOrGetter<readonly Player[]>,
  thresholds: MaybeRefOrGetter<Thresholds>
) {
  const lists = computed(() => {
    const t = toValue(thresholds);
    const { qualifiedPool, notEnoughWars } = splitByParticipation(
      toValue(players),
      t.minWarParticipation
    );
    const marked = markQualification(qualifiedPool, t.acceptancePct);
    return {
      qualifiedAbove: sortPlayers(marked.filter((p) => p.aboveLine)),
      qualifiedBelow: sortPlayers(marked.filter((p) => !p.aboveLine)),
      notEnoughWars: sortPlayers(notEnoughWars),
    };
  });

  return {
    qualifiedAbove: computed(() => lists.value.qualifiedAbove),
    qualifiedBelow: computed(() => lists.value.qualifiedBelow),
    notEnoughWars: computed(() => lists.value.notEnoughWars),
  };
}
