import type { InjectionKey } from 'vue';

export interface PendingInvite {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly createdAt: string;
  readonly expired: boolean;
}

export interface InvitationsApi {
  fetchPendingInvites(): Promise<readonly PendingInvite[]>;
  inviteAdmin(email: string): Promise<void>;
  revokeInvite(id: string): Promise<void>;
}

export const INVITATIONS_API: InjectionKey<InvitationsApi> = Symbol('InvitationsApi');

export const EMPTY_INVITATIONS_API: InvitationsApi = {
  fetchPendingInvites: async () => [],
  inviteAdmin: async () => {},
  revokeInvite: async () => {},
};

export function createInvitationsApi(): InvitationsApi {
  return {
    async fetchPendingInvites() {
      const res = await fetch('/api/listPendingInvites');
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to fetch invitations');
      }
      return res.json();
    },
    async inviteAdmin(email) {
      const res = await fetch('/api/inviteAdmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to invite admin');
      }
    },
    async revokeInvite(id) {
      const res = await fetch('/api/revokeInvite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to revoke invite');
      }
    },
  };
}
