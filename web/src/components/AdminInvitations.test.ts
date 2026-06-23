import { mount, flushPromises } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref } from 'vue';
import AdminInvitations from './AdminInvitations.vue';
import { INVITATIONS_API, type InvitationsApi, type PendingInvite } from '../api/invitations';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';

// Mock useSession composable
const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

const sampleInvite = (id: string, email: string, expired = false): PendingInvite => ({
  id,
  email,
  role: 'admin',
  createdAt: new Date().toISOString(),
  expired,
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe('AdminInvitations.vue', () => {
  let apiMock: InvitationsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock = {
      fetchPendingInvites: vi.fn().mockResolvedValue([]),
      inviteAdmin: vi.fn().mockResolvedValue(undefined),
      revokeInvite: vi.fn().mockResolvedValue(undefined),
    };
  });

  test('does not render if the user lacks canInviteAdmins capability', () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canInviteAdmins: false }),
    });

    const wrapper = mount(AdminInvitations, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        provide: {
          [INVITATIONS_API as symbol]: apiMock,
        },
      },
    });

    expect(wrapper.find('.ct-invitations-panel').exists()).toBe(false);
  });

  test('renders invitation UI if user has canInviteAdmins capability', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canInviteAdmins: true }),
    });

    const wrapper = mount(AdminInvitations, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        provide: {
          [INVITATIONS_API as symbol]: apiMock,
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('.ct-invitations-panel').exists()).toBe(true);
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').text()).toBe('SEND INVITE');
  });

  test('shows client-side validation error for invalid email and disables submit', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canInviteAdmins: true }),
    });

    const wrapper = mount(AdminInvitations, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        provide: {
          [INVITATIONS_API as symbol]: apiMock,
        },
      },
    });

    await flushPromises();

    const input = wrapper.find('input[type="email"]');
    await input.setValue('invalid-email');
    await wrapper.find('form').trigger('submit.prevent');

    // Should display validation error and not call API
    expect(wrapper.find('.validation-error').exists()).toBe(true);
    expect(wrapper.find('.validation-error').text()).toContain('Invalid email format');
    expect(apiMock.inviteAdmin).not.toHaveBeenCalled();
  });

  test('successfully submits a valid email and clears input', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canInviteAdmins: true }),
    });

    const wrapper = mount(AdminInvitations, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        provide: {
          [INVITATIONS_API as symbol]: apiMock,
        },
      },
    });

    await flushPromises();

    const input = wrapper.find('input[type="email"]');
    await input.setValue('test@example.com');
    await wrapper.find('form').trigger('submit.prevent');

    expect(apiMock.inviteAdmin).toHaveBeenCalledWith('test@example.com');
    await flushPromises();

    // Input should be cleared on success
    expect((input.element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.validation-error').exists()).toBe(false);
  });

  test('lists invitations, displaying expired badges and trigger revoke', async () => {
    mockUseSession.mockReturnValue({
      capabilities: ref({ canInviteAdmins: true }),
    });

    const list = [
      sampleInvite('inv-1', 'active@example.com', false),
      sampleInvite('inv-2', 'expired@example.com', true),
    ];
    apiMock.fetchPendingInvites = vi.fn().mockResolvedValue(list);

    const wrapper = mount(AdminInvitations, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: createQueryClient() }]],
        provide: {
          [INVITATIONS_API as symbol]: apiMock,
        },
      },
    });

    await flushPromises();

    const rows = wrapper.findAll('.invite-row');
    expect(rows.length).toBe(2);

    expect(rows[0].text()).toContain('active@example.com');
    expect(rows[0].find('.badge-expired').exists()).toBe(false);

    expect(rows[1].text()).toContain('expired@example.com');
    expect(rows[1].find('.badge-expired').exists()).toBe(true);
    expect(rows[1].find('.badge-expired').text()).toBe('EXPIRED');

    // Click revoke on the first row
    const revokeBtn = rows[0].find('.btn-revoke');
    await revokeBtn.trigger('click');

    expect(apiMock.revokeInvite).toHaveBeenCalledWith('inv-1');
  });
});
