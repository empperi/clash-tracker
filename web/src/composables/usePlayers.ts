import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { Player } from '@clash-tracker/core';
import { DEFAULT_THRESHOLDS, type PlayersApi, type Thresholds } from '../api/players';

/**
 * Loads the current clan players and the eligibility thresholds via vue-query
 * (cached, deduped, read-only). The data source is injected so tests run on
 * in-memory fakes — no live Firestore. Wiring supplies `createPlayersApi(db)`.
 */
export function usePlayers(api: PlayersApi) {
  const playersQuery = useQuery({
    queryKey: ['players', 'current'],
    queryFn: () => api.fetchCurrentPlayers(),
  });
  const thresholdsQuery = useQuery({
    queryKey: ['settings', 'thresholds'],
    queryFn: () => api.fetchThresholds(),
  });

  const players = computed<readonly Player[]>(() => playersQuery.data.value ?? []);
  const thresholds = computed<Thresholds>(() => thresholdsQuery.data.value ?? DEFAULT_THRESHOLDS);
  const isLoading = computed(() => playersQuery.isLoading.value || thresholdsQuery.isLoading.value);
  const isError = computed(() => playersQuery.isError.value || thresholdsQuery.isError.value);

  return { players, thresholds, isLoading, isError };
}
