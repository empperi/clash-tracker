import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import type { Player } from '@clash-tracker/core';
import { usePlayers } from './usePlayers';
import type { PlayersApi, Thresholds } from '../api/players';

const samplePlayer = (tag: string): Player => ({
  tag,
  name: tag.replace('#', ''),
  role: 'member',
  thLevel: 15,
  inClan: true,
  stats: {
    warsParticipated: 5,
    attacksDone: 8,
    attacksAvailable: 10,
    attackUsagePct: 80,
    medianDestruction: 90,
    medianStars: 2,
    medianDefenses: 1,
    medianOwnDestruction: 50,
    lastWarParticipatedAt: '2026-06-10T10:00:00.000Z',
  },
});

// Mounts a component running the composable, returning its reactive result.
function withUsePlayers(api: PlayersApi) {
  let result!: ReturnType<typeof usePlayers>;
  const Comp = defineComponent({
    setup() {
      result = usePlayers(api);
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { result: () => result, wrapper };
}

describe('usePlayers', () => {
  it('starts loading, then exposes players and thresholds from the injected api', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [samplePlayer('#A'), samplePlayer('#B')],
      fetchThresholds: async (): Promise<Thresholds> => ({
        acceptancePct: 70,
        minWarParticipation: 5,
      }),
      fetchPastPlayers: async () => [],
    };
    const { result } = withUsePlayers(api);

    expect(result().isLoading.value).toBe(true);

    await flushPromises();

    expect(result().isLoading.value).toBe(false);
    expect(result().isError.value).toBe(false);
    expect(result().players.value.map((p) => p.tag)).toEqual(['#A', '#B']);
    expect(result().thresholds.value).toEqual({ acceptancePct: 70, minWarParticipation: 5 });
  });

  it('flags isError when a fetch rejects', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => {
        throw new Error('network down');
      },
      fetchThresholds: async () => ({ acceptancePct: 0, minWarParticipation: 0 }),
      fetchPastPlayers: async () => [],
    };
    const { result } = withUsePlayers(api);

    await flushPromises();

    expect(result().isError.value).toBe(true);
  });
});
