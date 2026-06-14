import { describe, it, expect } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { Player } from '@clash-tracker/core';
import { usePastPlayers } from './usePastPlayers';
import type { PlayersApi, PastPlayersPage } from '../api/players';

function mk(tag: string, ts: string): Player {
  return {
    tag,
    name: tag.replace('#', ''),
    role: 'member',
    thLevel: 14,
    inClan: false,
    stats: {
      warsParticipated: 3,
      attacksDone: 0,
      attacksAvailable: 0,
      attackUsagePct: 0,
      medianDestruction: 0,
      medianStars: 0,
      medianDefenses: 0,
      medianOwnDestruction: 0,
      lastWarParticipatedAt: ts,
    },
  };
}

// Records every fetchPastPlayers call and returns a fixed two-page dataset.
function pagingApi() {
  const calls: PastPlayersPage[] = [];
  const all = [
    mk('#p1', '2026-06-12T00:00:00.000Z'),
    mk('#p2', '2026-06-11T00:00:00.000Z'),
    mk('#p3', '2026-06-10T00:00:00.000Z'),
  ];
  const api: PlayersApi = {
    fetchCurrentPlayers: async () => [],
    fetchThresholds: async () => ({ acceptancePct: 0, minWarParticipation: 0 }),
    fetchPastPlayers: async (page?: PastPlayersPage) => {
      calls.push(page ?? {});
      const start = page?.startAfter
        ? all.findIndex((p) => p.stats.lastWarParticipatedAt === page.startAfter) + 1
        : 0;
      return all.slice(start, start + (page?.limit ?? all.length));
    },
  };
  return { api, calls };
}

function withUsePastPlayers(api: PlayersApi, enabled = ref(false), pageSize = 2) {
  let result!: ReturnType<typeof usePastPlayers>;
  const Comp = defineComponent({
    setup() {
      result = usePastPlayers(api, enabled, pageSize);
      return () => h('div');
    },
  });
  const wrapper = mount(Comp);
  return { result: () => result, enabled, wrapper };
}

describe('usePastPlayers', () => {
  it('does not fetch until enabled', async () => {
    const { api, calls } = pagingApi();
    withUsePastPlayers(api, ref(false));
    await flushPromises();
    expect(calls).toHaveLength(0);
  });

  it('loads the first page when enabled and paginates on demand', async () => {
    const { api, calls } = pagingApi();
    const enabled = ref(false);
    const { result } = withUsePastPlayers(api, enabled, 2);

    enabled.value = true;
    await flushPromises();

    // First page: no cursor, limit 2.
    expect(calls[0]).toEqual({ limit: 2, startAfter: undefined });
    expect(result().pastPlayers.value.map((p) => p.tag)).toEqual(['#p1', '#p2']);
    expect(result().hasMore.value).toBe(true);

    await result().loadMore();
    await flushPromises();

    // Second page: cursor is the last loaded player's timestamp.
    expect(calls[1]).toEqual({ limit: 2, startAfter: '2026-06-11T00:00:00.000Z' });
    expect(result().pastPlayers.value.map((p) => p.tag)).toEqual(['#p1', '#p2', '#p3']);
  });

  it('marks hasMore false once a short page returns and stops fetching', async () => {
    const { api, calls } = pagingApi();
    const enabled = ref(true);
    const { result } = withUsePastPlayers(api, enabled, 2);
    await flushPromises();

    await result().loadMore(); // returns 1 (< pageSize) -> no more
    await flushPromises();
    expect(result().hasMore.value).toBe(false);

    const callsAfter = calls.length;
    await result().loadMore(); // no-op
    await flushPromises();
    expect(calls.length).toBe(callsAfter);
  });
});
