import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import type { Player } from '@clash-tracker/core';
import PastPlayersSection from './PastPlayersSection.vue';
import PlayerRow from './PlayerRow.vue';
import { PLAYERS_API, type PlayersApi, type PastPlayersPage } from '../api/players';
import { OBSERVER_FACTORY, type ObserverFactory } from '../api/observer';

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

function pagingApi() {
  const all = [
    mk('#p1', '2026-06-12T00:00:00.000Z'),
    mk('#p2', '2026-06-11T00:00:00.000Z'),
    mk('#p3', '2026-06-10T00:00:00.000Z'),
  ];
  const api: PlayersApi = {
    fetchCurrentPlayers: async () => [],
    fetchThresholds: async () => ({ acceptancePct: 0, minWarParticipation: 0 }),
    fetchPastPlayers: async (page?: PastPlayersPage) => {
      const start = page?.startAfter
        ? all.findIndex((p) => p.stats.lastWarParticipatedAt === page.startAfter) + 1
        : 0;
      return all.slice(start, start + (page?.limit ?? all.length));
    },
  };
  return api;
}

function mountSection(api: PlayersApi) {
  let intersect: (() => void) | null = null;
  const observed: Element[] = [];
  const factory: ObserverFactory = (cb) => {
    intersect = cb;
    return { observe: (el) => observed.push(el), disconnect: () => {} };
  };
  const wrapper = mount(PastPlayersSection, {
    props: { pageSize: 2 },
    global: {
      provide: {
        [PLAYERS_API as symbol]: api,
        [OBSERVER_FACTORY as symbol]: factory,
      },
    },
  });
  return { wrapper, observed, triggerIntersect: () => intersect?.() };
}

describe('PastPlayersSection', () => {
  it('does not load until the reveal toggle is clicked', async () => {
    const { wrapper } = mountSection(pagingApi());
    await flushPromises();
    expect(wrapper.findComponent(PlayerRow).exists()).toBe(false);
    expect(wrapper.find('.toggle').exists()).toBe(true);
  });

  it('loads the first page on reveal and observes the sentinel', async () => {
    const { wrapper, observed } = mountSection(pagingApi());
    await wrapper.find('.toggle').trigger('click');
    await flushPromises();

    expect(
      wrapper.findAllComponents(PlayerRow).map((r) => (r.props('player') as Player).tag)
    ).toEqual(['#p1', '#p2']);
    expect(observed.length).toBeGreaterThan(0); // sentinel is observed for infinite scroll
  });

  it('appends the next page when the sentinel intersects', async () => {
    const { wrapper, triggerIntersect } = mountSection(pagingApi());
    await wrapper.find('.toggle').trigger('click');
    await flushPromises();

    triggerIntersect();
    await flushPromises();

    const tags = wrapper.findAllComponents(PlayerRow).map((r) => (r.props('player') as Player).tag);
    expect(tags).toEqual(['#p1', '#p2', '#p3']);
  });
});
