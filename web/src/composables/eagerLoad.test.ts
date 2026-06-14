import { describe, it, expect } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { QueryClient } from '@tanstack/vue-query';
import { createEagerLoader } from './eagerLoad';
import type { PlayersApi } from '../api/players';

function countingApi() {
  let players = 0;
  let thresholds = 0;
  const api: PlayersApi = {
    fetchCurrentPlayers: async () => {
      players += 1;
      return [];
    },
    fetchThresholds: async () => {
      thresholds += 1;
      return { acceptancePct: 0, minWarParticipation: 0 };
    },
    fetchPastPlayers: async () => [],
  };
  return { api, counts: () => ({ players, thresholds }) };
}

describe('createEagerLoader', () => {
  it('prefetches the player list data when swiping toward player-list', async () => {
    const { api, counts } = countingApi();
    const loader = createEagerLoader(new QueryClient(), api);

    loader('player-list');
    await flushPromises();

    expect(counts()).toEqual({ players: 1, thresholds: 1 });
  });

  it('does nothing for other target views', async () => {
    const { api, counts } = countingApi();
    const loader = createEagerLoader(new QueryClient(), api);

    loader('war-plan');
    loader('admin');
    await flushPromises();

    expect(counts()).toEqual({ players: 0, thresholds: 0 });
  });
});
