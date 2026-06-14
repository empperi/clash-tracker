import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import type { Player } from '@clash-tracker/core';
import PlayerListView from './PlayerListView.vue';
import PlayerRow from '../components/PlayerRow.vue';
import QualificationLine from '../components/QualificationLine.vue';
import PastPlayersSection from '../components/PastPlayersSection.vue';
import { PLAYERS_API, type PlayersApi, type Thresholds } from '../api/players';
import { CAN_VIEW_PAST_PLAYERS } from '../api/session';

function mk(tag: string, wars: number, usage: number): Player {
  return {
    tag,
    name: tag.replace('#', ''),
    role: 'member',
    thLevel: 15,
    inClan: true,
    stats: {
      warsParticipated: wars,
      attacksDone: 0,
      attacksAvailable: 0,
      attackUsagePct: usage,
      medianDestruction: 0,
      medianStars: 0,
      medianDefenses: 0,
      medianOwnDestruction: 0,
      lastWarParticipatedAt: null,
    },
  };
}

function mountView(api: PlayersApi, canViewPastPlayers = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(PlayerListView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: {
        [PLAYERS_API as symbol]: api,
        [CAN_VIEW_PAST_PLAYERS as symbol]: ref(canViewPastPlayers),
      },
    },
  });
}

const rosterApi = (players: readonly Player[]): PlayersApi => ({
  fetchCurrentPlayers: async () => players,
  fetchThresholds: async () => okThresholds,
  fetchPastPlayers: async () => [],
});

const okThresholds: Thresholds = { acceptancePct: 70, minWarParticipation: 5 };

describe('PlayerListView', () => {
  it('shows a loading state before data resolves', () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: () => new Promise(() => {}), // never resolves
      fetchThresholds: () => new Promise(() => {}),
      fetchPastPlayers: async () => [],
    };
    const wrapper = mountView(api);
    expect(wrapper.find('.state-loading').exists()).toBe(true);
  });

  it('shows an empty state when there are no players', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [],
      fetchThresholds: async () => okThresholds,
      fetchPastPlayers: async () => [],
    };
    const wrapper = mountView(api);
    await flushPromises();
    expect(wrapper.find('.state-empty').exists()).toBe(true);
    expect(wrapper.findComponent(PlayerRow).exists()).toBe(false);
  });

  it('shows an error state when loading fails', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => {
        throw new Error('boom');
      },
      fetchThresholds: async () => okThresholds,
      fetchPastPlayers: async () => [],
    };
    const wrapper = mountView(api);
    await flushPromises();
    expect(wrapper.find('.state-error').exists()).toBe(true);
  });

  it('renders both lists, the qualification line, and ranks within each group', async () => {
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [
        mk('#below', 10, 50),
        mk('#a', 10, 95),
        mk('#few', 2, 100),
        mk('#b', 10, 80),
      ],
      fetchThresholds: async () => okThresholds,
      fetchPastPlayers: async () => [],
    };
    const wrapper = mountView(api);
    await flushPromises();

    // The divider is present.
    expect(wrapper.findComponent(QualificationLine).exists()).toBe(true);

    // All four players render as rows, in the full expected order:
    // above (usage desc) -> below -> not-enough.
    const names = wrapper
      .findAllComponents(PlayerRow)
      .map((r) => (r.props('player') as Player).tag);
    expect(names).toEqual(['#a', '#b', '#below', '#few']);

    // Above-the-line players (and only those) carry the qualified flag + styling.
    const qualifiedRows = wrapper
      .findAllComponents(PlayerRow)
      .filter((r) => r.props('qualified') === true)
      .map((r) => (r.props('player') as Player).tag);
    expect(qualifiedRows).toEqual(['#a', '#b']);
  });

  it('hides the past-players section when the viewer lacks the capability', async () => {
    const wrapper = mountView(rosterApi([mk('#a', 10, 95)]), false);
    await flushPromises();
    expect(wrapper.findComponent(PastPlayersSection).exists()).toBe(false);
  });

  it('shows the past-players section when the viewer has the capability', async () => {
    const wrapper = mountView(rosterApi([mk('#a', 10, 95)]), true);
    await flushPromises();
    expect(wrapper.findComponent(PastPlayersSection).exists()).toBe(true);
  });

  it('re-splits when thresholds change without refetching players', async () => {
    let playerFetches = 0;
    const api: PlayersApi = {
      fetchCurrentPlayers: async () => {
        playerFetches += 1;
        return [mk('#p', 10, 80)];
      },
      fetchThresholds: async () => okThresholds,
      fetchPastPlayers: async () => [],
    };
    const wrapper = mountView(api);
    await flushPromises();

    // At 70% acceptance the player is above the line.
    expect(wrapper.findComponent(PlayerRow).props('qualified')).toBe(true);
    expect(playerFetches).toBe(1);
  });
});
