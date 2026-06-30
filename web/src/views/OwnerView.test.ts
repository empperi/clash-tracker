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
      setApiToken: vi.fn().mockResolvedValue(undefined),
      getApiTokenStatus: vi.fn().mockResolvedValue(false),
      listAccounts: vi.fn().mockResolvedValue([]),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
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
    expect(wrapper.text()).toContain('Loading session...');
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  test('displays Access Denied when user is not an owner', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: false }),
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

  test('validates and updates CoC API token on save', async () => {
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

    const tokenInput = wrapper.find('#apiToken');

    // Test empty validation
    await tokenInput.setValue('');
    await wrapper.find('.save-token-btn').trigger('click');
    expect(wrapper.find('.token-error').text()).toContain('cannot be empty');
    expect(mockOwnerApi.setApiToken).not.toHaveBeenCalled();

    // Test too short validation
    await tokenInput.setValue('too-short');
    await wrapper.find('.save-token-btn').trigger('click');
    expect(wrapper.find('.token-error').text()).toContain('too short');
    expect(mockOwnerApi.setApiToken).not.toHaveBeenCalled();

    // Test valid submission
    const validToken = 'a'.repeat(50);
    await tokenInput.setValue(validToken);
    await wrapper.find('.save-token-btn').trigger('click');

    expect(mockOwnerApi.setApiToken).toHaveBeenCalledWith(validToken);
    await flushPromises();
    expect(wrapper.find('.token-success').text()).toContain('saved successfully');
    // Plaintext token input should be cleared for security
    expect((tokenInput.element as HTMLInputElement).value).toBe('');
  });

  test('renders API token configured/not-configured status correctly', async () => {
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

    // 1. Initially false / not configured
    mockOwnerApi.getApiTokenStatus = vi.fn().mockResolvedValue(false);
    let wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('.token-status-badge.is-empty').exists()).toBe(true);
    expect(wrapper.find('.token-status-badge.is-empty').text()).toContain('Not configured');

    // 2. Configured
    mockOwnerApi.getApiTokenStatus = vi.fn().mockResolvedValue(true);
    wrapper = mountView();
    await flushPromises();
    expect(wrapper.find('.token-status-badge.is-set').exists()).toBe(true);
    expect(wrapper.find('.token-status-badge.is-set').text()).toContain('Active (Set)');
  });

  test('lists and displays accounts, disabling delete for logged-in user', async () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
      user: ref({ uid: 'my-owner-uid' }),
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

    const mockAccounts = [
      {
        uid: 'my-owner-uid',
        email: 'owner@example.com',
        role: 'owner',
        status: 'active',
        username: 'The Owner',
      },
      {
        uid: 'other-admin-uid',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        username: 'The Admin',
      },
      { uid: 'pending-invite-uid', email: 'pending@example.com', role: 'admin', status: 'pending' },
    ];
    mockOwnerApi.listAccounts = vi.fn().mockResolvedValue(mockAccounts);

    const wrapper = mountView();
    await flushPromises();

    // Verify listAccounts was called
    expect(mockOwnerApi.listAccounts).toHaveBeenCalled();

    // Verify details are rendered
    expect(wrapper.text()).toContain('The Owner');
    expect(wrapper.text()).toContain('owner@example.com');
    expect(wrapper.text()).toContain('The Admin');
    expect(wrapper.text()).toContain('admin@example.com');
    expect(wrapper.text()).toContain('pending@example.com');

    // Verify delete buttons
    const deleteButtons = wrapper.findAll('.delete-account-btn');
    expect(deleteButtons.length).toBe(3);

    // Button 0 (Owner) should be disabled
    expect(deleteButtons[0].attributes('disabled')).toBeDefined();

    // Button 1 (Admin) should be enabled
    expect(deleteButtons[1].attributes('disabled')).toBeUndefined();

    // Button 2 (Pending) should be enabled
    expect(deleteButtons[2].attributes('disabled')).toBeUndefined();
  });

  test('calls deleteAccount and refreshes the list on delete click', async () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ isOwner: true }),
      user: ref({ uid: 'my-owner-uid' }),
    });
    mockUseClanConfig.mockReturnValue({
      config: ref({
        clanName: 'Clash Clan',
        clanTag: '#2PGQYPQ',
      }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const mockAccounts = [
      { uid: 'my-owner-uid', email: 'owner@example.com', role: 'owner', status: 'active' },
      { uid: 'other-admin-uid', email: 'admin@example.com', role: 'admin', status: 'active' },
    ];
    mockOwnerApi.listAccounts = vi.fn().mockResolvedValue(mockAccounts);
    mockOwnerApi.deleteAccount = vi.fn().mockResolvedValue(undefined);

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mountView();
    await flushPromises();

    const deleteButtons = wrapper.findAll('.delete-account-btn');
    // Click on Button 1 (other admin)
    await deleteButtons[1].trigger('click');

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockOwnerApi.deleteAccount).toHaveBeenCalledWith('other-admin-uid');

    // Check that listAccounts was called again to refresh
    expect(mockOwnerApi.listAccounts).toHaveBeenCalledTimes(2);

    confirmSpy.mockRestore();
  });
});
