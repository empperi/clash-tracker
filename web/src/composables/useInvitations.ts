import { computed } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import type { InvitationsApi, PendingInvite } from '../api/invitations';

export function useInvitations(api: InvitationsApi) {
  const queryClient = useQueryClient();

  const invitationsQuery = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api.fetchPendingInvites(),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.inviteAdmin(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
  });

  const invitations = computed<readonly PendingInvite[]>(() => invitationsQuery.data.value ?? []);
  const isLoading = computed(() => invitationsQuery.isLoading.value);
  const isError = computed(() => invitationsQuery.isError.value);

  const isInviting = computed(() => inviteMutation.isPending.value);
  const isRevoking = computed(() => revokeMutation.isPending.value);

  async function invite(email: string) {
    await inviteMutation.mutateAsync(email);
  }

  async function revoke(id: string) {
    await revokeMutation.mutateAsync(id);
  }

  return {
    invitations,
    isLoading,
    isError,
    isInviting,
    isRevoking,
    invite,
    revoke,
  };
}
