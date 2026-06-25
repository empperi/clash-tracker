import { mount, flushPromises } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref, defineComponent, h } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import type { Player } from '@clash-tracker/core';
import type { PlayersApi } from '../api/players';
import { usePlayers } from '../composables/usePlayers';
import { usePlayerLists } from '../composables/usePlayerLists';
import AcceptancePercentSlider from './AcceptancePercentSlider.vue';

// Mock useSession
const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const mkPlayer = (tag: string, usage: number): Player => ({
  tag,
  name: tag.replace('#', ''),
  role: 'member',
  thLevel: 15,
  inClan: true,
  stats: {
    warsParticipated: 10,
    attacksDone: 0,
    attacksAvailable: 0,
    attackUsagePct: usage,
    medianDestruction: 0,
    medianStars: 0,
    medianDefenses: 0,
    medianOwnDestruction: 0,
    lastWarParticipatedAt: null,
  },
});

describe('Threshold Sliders Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  test('changing the slider debounces, updates settings, and re-splits the players lists', async () => {
    // 1. Setup mock session (admin privilege)
    mockUseSession.mockReturnValue({
      capabilities: ref({ canEditThresholds: true }),
    });

    // 2. Setup reactive mock settings/thresholds state
    const currentThresholds = {
      acceptancePct: 70,
      minWarParticipation: 5,
    };

    const api: PlayersApi = {
      fetchCurrentPlayers: async () => [
        mkPlayer('#p1', 80), // Qualified above the line (80% >= 70%)
        mkPlayer('#p2', 60), // Qualified below the line (60% < 70%)
      ],
      fetchThresholds: async () => ({ ...currentThresholds }),
      fetchPastPlayers: async () => [],
    };

    // 3. Mock network calls: when setThreshold is called, update the local mock thresholds state
    const fetchMock = vi.fn().mockImplementation(async (url, options) => {
      const body = JSON.parse(options.body);
      if (body.field === 'acceptancePct') {
        currentThresholds.acceptancePct = body.value;
      }
      return { ok: true };
    });
    global.fetch = fetchMock;

    // 4. Create an integration host component that stitches it together
    const HostComp = defineComponent({
      setup() {
        const { players, thresholds } = usePlayers(api);
        const { qualifiedAbove, qualifiedBelow } = usePlayerLists(players, thresholds);

        return () =>
          h('div', [
            h(AcceptancePercentSlider, {
              modelValue: thresholds.value.acceptancePct,
            }),
            h('div', { id: 'above-tags' }, qualifiedAbove.value.map((p) => p.tag).join(',')),
            h('div', { id: 'below-tags' }, qualifiedBelow.value.map((p) => p.tag).join(',')),
          ]);
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    const wrapper = mount(HostComp, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    });

    // Wait for initial load
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Verify initial layout splits: p1 is above (80% >= 70%), p2 is below (60% < 70%)
    expect(wrapper.find('#above-tags').text()).toBe('#p1');
    expect(wrapper.find('#below-tags').text()).toBe('#p2');

    // 5. Simulate user dragging the slider to 90
    const input = wrapper.find('input[type="range"]');
    (input.element as HTMLInputElement).value = '90';
    await input.trigger('input');

    // 6. Fast-forward past debounce timeout (500ms)
    await vi.advanceTimersByTimeAsync(500);

    // Yield to the fetch execution promise
    await vi.runAllTicks();
    await flushPromises();

    // Check if the API was invoked with the new threshold
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/setThreshold',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ field: 'acceptancePct', value: 90 }),
      })
    );

    // Wait for the re-fetch queries to complete and flush Vue DOM updates
    await flushPromises();
    await wrapper.vm.$nextTick();

    // Verify updated layout: because acceptancePct is 90, p1 (80%) is now BELOW the line!
    expect(wrapper.find('#above-tags').text()).toBe('');
    expect(wrapper.find('#below-tags').text()).toBe('#p1,#p2');
  });
});
