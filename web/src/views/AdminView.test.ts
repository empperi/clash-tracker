import { mount } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref } from 'vue';
import AdminView from './AdminView.vue';

// Mock useSession composable
const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

// Mock usePlayers composable
const mockUsePlayers = vi.fn();
vi.mock('../composables/usePlayers', () => ({
  usePlayers: () => mockUsePlayers(),
}));

describe('AdminView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('displays loading session state when session is loading', () => {
    mockUseSession.mockReturnValue({
      loading: ref(true),
      capabilities: ref({ canInviteAdmins: false, canEditThresholds: false }),
    });

    mockUsePlayers.mockReturnValue({
      thresholds: ref({ acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          AcceptancePercentSlider: true,
          MinWarParticipationSlider: true,
          AdminInvitations: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Loading session...');
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  test('displays Access Denied when user is unauthenticated or has no admin/owner roles', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ canInviteAdmins: false, canEditThresholds: false }),
    });

    mockUsePlayers.mockReturnValue({
      thresholds: ref({ acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          AcceptancePercentSlider: true,
          MinWarParticipationSlider: true,
          AdminInvitations: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Access Denied');
    expect(wrapper.text()).toContain('You must be an administrator or owner to view this page.');
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  test('displays loading thresholds state when players/thresholds are loading', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ canInviteAdmins: true, canEditThresholds: true }),
    });

    mockUsePlayers.mockReturnValue({
      thresholds: ref({ acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(true),
      isError: ref(false),
    });

    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          AcceptancePercentSlider: true,
          MinWarParticipationSlider: true,
          AdminInvitations: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Admin Settings');
    expect(wrapper.text()).toContain('Loading thresholds...');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  test('displays error state when thresholds query fails', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ canInviteAdmins: true, canEditThresholds: true }),
    });

    mockUsePlayers.mockReturnValue({
      thresholds: ref({ acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(true),
    });

    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          AcceptancePercentSlider: true,
          MinWarParticipationSlider: true,
          AdminInvitations: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Failed to load thresholds from server.');
  });

  test('renders sliders and invitations UI when authorized and data loaded', () => {
    mockUseSession.mockReturnValue({
      loading: ref(false),
      capabilities: ref({ canInviteAdmins: true, canEditThresholds: true }),
    });

    mockUsePlayers.mockReturnValue({
      thresholds: ref({ acceptancePct: 80, minWarParticipation: 3 }),
      isLoading: ref(false),
      isError: ref(false),
    });

    const wrapper = mount(AdminView, {
      global: {
        stubs: {
          AcceptancePercentSlider: true,
          MinWarParticipationSlider: true,
          AdminInvitations: true,
        },
      },
    });

    expect(wrapper.text()).toContain('Admin Settings');
    expect(wrapper.findComponent({ name: 'AcceptancePercentSlider' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'MinWarParticipationSlider' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'AdminInvitations' }).exists()).toBe(true);
  });
});
