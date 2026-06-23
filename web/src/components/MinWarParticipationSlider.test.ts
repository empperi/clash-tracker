import { mount } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref } from 'vue';
import MinWarParticipationSlider from './MinWarParticipationSlider.vue';

// Mock useSession composable
const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

// Mock useQueryClient
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe('MinWarParticipationSlider.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  test('does not render if the user lacks canEditThresholds capability', () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canEditThresholds: false }),
    });

    const wrapper = mount(MinWarParticipationSlider, {
      props: {
        modelValue: 3,
      },
    });

    expect(wrapper.find('.ct-slider-item').exists()).toBe(false);
  });

  test('renders slider controls if user has canEditThresholds capability', () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canEditThresholds: true }),
    });

    const wrapper = mount(MinWarParticipationSlider, {
      props: {
        modelValue: 3,
      },
    });

    expect(wrapper.find('.ct-slider-item').exists()).toBe(true);
    expect(wrapper.find('.value-display').text()).toBe('3 Wars');
    const input = wrapper.find('input[type="range"]');
    expect(input.exists()).toBe(true);
    expect((input.element as HTMLInputElement).value).toBe('3');
  });

  test('emits update:modelValue and change events immediately on input', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canEditThresholds: true }),
    });

    const wrapper = mount(MinWarParticipationSlider, {
      props: {
        modelValue: 3,
      },
    });

    const input = wrapper.find('input[type="range"]');
    (input.element as HTMLInputElement).value = '5';
    await input.trigger('input');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([5]);
    expect(wrapper.emitted('change')?.[0]).toEqual([5]);
    expect(wrapper.find('.value-display').text()).toBe('5 Wars');
  });

  test('debounces network calls and updates saving/saved indicators', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canEditThresholds: true }),
    });

    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = fetchMock;

    const wrapper = mount(MinWarParticipationSlider, {
      props: {
        modelValue: 3,
      },
    });

    const input = wrapper.find('input[type="range"]');
    (input.element as HTMLInputElement).value = '4';
    await input.trigger('input');

    // Network call should not have occurred immediately due to debounce
    expect(fetchMock).not.toHaveBeenCalled();

    // Fast-forward debounce timer (500ms)
    await vi.advanceTimersByTimeAsync(500);
    await wrapper.vm.$nextTick();

    expect(fetchMock).toHaveBeenCalledWith('/api/setThreshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'minWarParticipation', value: 4 }),
    });

    expect(wrapper.find('.indicator.saving').exists()).toBe(true);

    // Resolve the promise
    resolveFetch({ ok: true });
    await vi.runAllTicks();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.indicator.saved').exists()).toBe(true);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['settings', 'thresholds'] });

    // Wait for the "Saved" notification timer (2000ms) to clear
    await vi.advanceTimersByTimeAsync(2000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.indicator').exists()).toBe(false);
  });
});
