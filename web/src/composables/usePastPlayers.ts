import { readonly, ref, watch, type Ref } from 'vue';
import type { Player } from '@clash-tracker/core';
import type { PlayersApi } from '../api/players';

/**
 * Lazily loads players who have left the clan, ordered by most-recent war
 * participation, paginated with a cursor over `fetchPastPlayers`.
 *
 * Nothing is fetched until `enabled` becomes true (the admin reveals the
 * section). `loadMore` appends the next page using the last loaded row's
 * `lastWarParticipatedAt` as the cursor; `hasMore` goes false once a short
 * page returns.
 */
export function usePastPlayers(api: PlayersApi, enabled: Ref<boolean>, pageSize = 20) {
  const pastPlayers = ref<Player[]>([]);
  const isLoading = ref(false);
  const hasMore = ref(true);
  let started = false;

  async function loadMore(): Promise<void> {
    if (isLoading.value || !hasMore.value || !enabled.value) {
      return;
    }
    isLoading.value = true;
    try {
      const cursor = pastPlayers.value.at(-1)?.stats.lastWarParticipatedAt ?? undefined;
      const page = await api.fetchPastPlayers({ limit: pageSize, startAfter: cursor ?? undefined });
      pastPlayers.value = [...pastPlayers.value, ...page];
      if (page.length < pageSize) {
        hasMore.value = false;
      }
    } finally {
      isLoading.value = false;
    }
  }

  watch(
    enabled,
    (on) => {
      if (on && !started) {
        started = true;
        void loadMore();
      }
    },
    { immediate: true }
  );

  return {
    pastPlayers: readonly(pastPlayers),
    isLoading: readonly(isLoading),
    hasMore: readonly(hasMore),
    loadMore,
  };
}
