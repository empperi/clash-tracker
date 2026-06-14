import type { QueryClient } from '@tanstack/vue-query';
import type { PlayersApi } from '../api/players';

/**
 * Builds the swipe-start eager loader. When a swipe begins toward the Player
 * List, it primes the same vue-query caches `usePlayers` reads, so the data is
 * already loading before the view animates in (per the product's eager-load
 * rule). Other target views are no-ops here.
 *
 * Query keys must match `usePlayers` exactly so the prefetch populates the cache.
 */
export function createEagerLoader(
  queryClient: QueryClient,
  api: PlayersApi
): (view: string) => void {
  return (view: string) => {
    if (view !== 'player-list') {
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: ['players', 'current'],
      queryFn: () => api.fetchCurrentPlayers(),
    });
    void queryClient.prefetchQuery({
      queryKey: ['settings', 'thresholds'],
      queryFn: () => api.fetchThresholds(),
    });
  };
}
