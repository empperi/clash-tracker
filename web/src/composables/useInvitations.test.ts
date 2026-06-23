import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import { useInvitations } from './useInvitations';
import type { InvitationsApi, PendingInvite } from '../api/invitations';

const sampleInvite = (id: string, email: string, expired = false): PendingInvite => ({
  id,
  email,
  role: 'admin',
  createdAt: new Date().toISOString(),
  expired,
});

function withUseInvitations(api: InvitationsApi) {
  let result!: ReturnType<typeof useInvitations>;
  const Comp = defineComponent({
    setup() {
      result = useInvitations(api);
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { result: () => result, wrapper, queryClient };
}

describe('useInvitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts loading, then exposes invitations from the injected api', async () => {
    const list = [sampleInvite('inv-1', 'test1@example.com'), sampleInvite('inv-2', 'test2@example.com')];
    const api: InvitationsApi = {
      fetchPendingInvites: vi.fn().mockResolvedValue(list),
      inviteAdmin: vi.fn().mockResolvedValue(undefined),
      revokeInvite: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = withUseInvitations(api);

    expect(result().isLoading.value).toBe(true);

    await flushPromises();

    expect(result().isLoading.value).toBe(false);
    expect(result().isError.value).toBe(false);
    expect(result().invitations.value).toEqual(list);
    expect(api.fetchPendingInvites).toHaveBeenCalled();
  });

  it('flags isError when a fetch rejects', async () => {
    const api: InvitationsApi = {
      fetchPendingInvites: vi.fn().mockRejectedValue(new Error('fetch error')),
      inviteAdmin: vi.fn(),
      revokeInvite: vi.fn(),
    };

    const { result } = withUseInvitations(api);

    await flushPromises();

    expect(result().isLoading.value).toBe(false);
    expect(result().isError.value).toBe(true);
  });

  it('performs invite mutation, calls api, and invalidates query client', async () => {
    const api: InvitationsApi = {
      fetchPendingInvites: vi.fn().mockResolvedValue([]),
      inviteAdmin: vi.fn().mockResolvedValue(undefined),
      revokeInvite: vi.fn().mockResolvedValue(undefined),
    };

    const { result, queryClient } = withUseInvitations(api);
    await flushPromises();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Run the invite action
    await result().invite('new-admin@example.com');

    expect(api.inviteAdmin).toHaveBeenCalledWith('new-admin@example.com');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invitations'] });
  });

  it('performs revoke mutation, calls api, and invalidates query client', async () => {
    const api: InvitationsApi = {
      fetchPendingInvites: vi.fn().mockResolvedValue([]),
      inviteAdmin: vi.fn().mockResolvedValue(undefined),
      revokeInvite: vi.fn().mockResolvedValue(undefined),
    };

    const { result, queryClient } = withUseInvitations(api);
    await flushPromises();

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Run the revoke action
    await result().revoke('inv-123');

    expect(api.revokeInvite).toHaveBeenCalledWith('inv-123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['invitations'] });
  });
});
