import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { DEFAULT_CLAN_CONFIG, type PlayersApi, type ClanConfig } from '../api/players';

/**
 * Loads the public settings config (clanName, clanTag, etc.) via vue-query.
 */
export function useClanConfig(api: PlayersApi) {
  const query = useQuery({
    queryKey: ['settings', 'config'],
    queryFn: () => api.fetchClanConfig(),
  });

  const config = computed<ClanConfig>(() => query.data.value ?? DEFAULT_CLAN_CONFIG);
  const isLoading = computed(() => query.isLoading.value);
  const isError = computed(() => query.isError.value);

  return { config, isLoading, isError };
}
