import { mount, flushPromises } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import OwnerView from './OwnerView.vue';
import { OWNER_API, type OwnerApi } from '../api/owner';
import { PLAYERS_API, type PlayersApi } from '../api/players';

// Mock useSession composable
const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

// Mock useClanConfig composable
const mockUseClanConfig = vi.fn();
vi.mock('../composables/useClanConfig', () => ({
  useClanConfig: () => mockUseClanConfig(),
}));

describe('OwnerView.vue', () => {
  let mockOwnerApi: OwnerApi;
  let mockPlayersApi: PlayersApi;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOwnerApi = {
      setClanName: vi.fn().mockResolvedValue(undefined),
      setClanTag: vi.fn().mockResolvedValue(undefined),
    } as unknown as OwnerApi;
    mockPlayersApi = {
      fetchCurrentPlayers: vi.fn().mockResolvedValue([]),
      fetchThresholds: vi.fn().mockResolvedValue({ acceptancePct: 0, minWarParticipation: 0 }),
      fetchPastPlayers: vi.fn().mockResolvedValue([]),
      fetchClanConfig: vi.fn().mockResolvedValue({
        clanName: 'Clash Clan',
        clanTag: '#2PGQYPQ',
        acceptancePct: 80,
        minWarParticipation: 3,
      }),
    } as unknown as PlayersApi;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function mountView() {
    return mount(OwnerView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        provide: {
          [OWNER_API]: mockOwnerApi,
          [PLAYERS_API]: mockPlayersApi,
        },
      },
    });
  }

  test('displays loading session state when session is loading', () => {
    mockUseSession.mockReturnValue({
      loading: ref(true),
      capabilities: ref({ isOwner: false }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({ clanName: 'Clash Clan', clanTag: '#2PGQYPQ', acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mountView();
    expect(wrapper.text()).toContain('Loading session...');
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  test('displays Access Denied when user is not an owner', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: false }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({ clanName: 'Clash Clan', clanTag: '#2PGQYPQ', acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mountView();
    expect(wrapper.text()).toContain('Access Denied');
    expect(wrapper.text()).toContain('You must be the owner to view this page.');
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  test('displays loading config state when config is loading', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref(null),
      isLoading: ref(true),
      isError: ref(false),
    });

    const wrapper = mountView();
    expect(wrapper.text()).toContain('Owner Dashboard');
    expect(wrapper.text()).toContain('Loading configuration...');
  });

  test('displays error state when config query fails', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref(null),
      isLoading: ref(false),
      isError: ref(true),
    });

    const wrapper = mountView();
    expect(wrapper.text()).toContain('Failed to load configuration from server.');
  });

  test('renders configuration form with fields', async () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({
        clanName: 'Clash Clan',
        clanTag: '#2PGQYPQ',
        acceptancePct: 80,
        minWarParticipation: 3,
      }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find('h2').text()).toBe('Owner Dashboard');
    expect(wrapper.find('#clanName').element).toBeDefined();
    expect(wrapper.find('#clanTag').element).toBeDefined();
    expect((wrapper.find('#clanName').element as HTMLInputElement).value).toBe('Clash Clan');
    expect((wrapper.find('#clanTag').element as HTMLInputElement).value).toBe('#2PGQYPQ');
  });

  test('validates and updates clan name on save', async () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({
        clanName: 'Clash Clan',
        clanTag: '#2PGQYPQ',
        acceptancePct: 80,
        minWarParticipation: 3,
      }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mountView();
    await flushPromises();

    const nameInput = wrapper.find('#clanName');
    
    // Test empty validation
    await nameInput.setValue('');
    await wrapper.find('.save-name-btn').trigger('click');
    expect(wrapper.find('.name-error').text()).toContain('cannot be empty');
    expect(mockOwnerApi.setClanName).not.toHaveBeenCalled();

    // Test valid submission
    await nameInput.setValue('New Clan Name');
    await wrapper.find('.save-name-btn').trigger('click');
    
    expect(mockOwnerApi.setClanName).toHaveBeenCalledWith('New Clan Name');
    await flushPromises();
    expect(wrapper.find('.name-success').text()).toContain('Name saved successfully');
  });

  test('validates and updates clan tag on save', async () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({
        clanName: 'Clash Clan',
        clanTag: '#2PGQYPQ',
        acceptancePct: 80,
        minWarParticipation: 3,
      }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mountView();
    await flushPromises();

    const tagInput = wrapper.find('#clanTag');

    // Test invalid format validation
    await tagInput.setValue('invalid-tag');
    await wrapper.find('.save-tag-btn').trigger('click');
    expect(wrapper.find('.tag-error').text()).toContain('Invalid clan tag format');
    expect(mockOwnerApi.setClanTag).not.toHaveBeenCalled();

    // Test valid submission
    await tagInput.setValue('2pgqypq');
    await wrapper.find('.save-tag-btn').trigger('click');

    expect(mockOwnerApi.setClanTag).toHaveBeenCalledWith('#2PGQYPQ');
    await flushPromises();
    expect(wrapper.find('.tag-success').text()).toContain('Tag saved successfully');
  });
});
