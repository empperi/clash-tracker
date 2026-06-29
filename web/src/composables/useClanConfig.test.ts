import { describe, it, expect } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { useClanConfig } from './useClanConfig';
import type { PlayersApi, ClanConfig } from '../api/players';

function withUseClanConfig(api: PlayersApi) {
  let result!: ReturnType<typeof useClanConfig>;
  const Comp = defineComponent({
    setup() {
      result = useClanConfig(api);
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { result: () => result, wrapper };
}

describe('useClanConfig', () => {
  it('starts loading, then exposes the settings config from the injected api', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [],
      fetchThresholds: async () => ({ acceptancePct: 0, minWarParticipation: 0 }),
      fetchPastPlayers: async () => [],
      fetchClanConfig: async (): Promise<ClanConfig> => ({
        clanName: 'Test Clan',
        clanTag: '#TESTTAG',
        acceptancePct: 80,
        minWarParticipation: 10,
      }),
    };
    const { result } = withUseClanConfig(api);

    expect(result().isLoading.value).toBe(true);

    await flushPromises();

    expect(result().isLoading.value).toBe(false);
    expect(result().isError.value).toBe(false);
    expect(result().config.value).toEqual({
      clanName: 'Test Clan',
      clanTag: '#TESTTAG',
      acceptancePct: 80,
      minWarParticipation: 10,
    });
  });

  it('flags isError when a fetch rejects', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [],
      fetchThresholds: async () => ({ acceptancePct: 0, minWarParticipation: 0 }),
      fetchPastPlayers: async () => [],
      fetchClanConfig: async () => {
        throw new Error('Database error');
      },
    };
    const { result } = withUseClanConfig(api);

    await flushPromises();

    expect(result().isError.value).toBe(true);
  });
});
