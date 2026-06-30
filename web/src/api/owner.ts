import type { InjectionKey } from 'vue';

export interface OwnerAccount {
  readonly uid: string;
  readonly email: string;
  readonly role: 'owner' | 'admin';
  readonly status: 'active' | 'pending';
  readonly username?: string;
}

export interface OwnerApi {
  setClanName(clanName: string): Promise<void>;
  setClanTag(clanTag: string): Promise<void>;
  setApiToken(token: string): Promise<void>;
  getApiTokenStatus(): Promise<boolean>;
  listAccounts(): Promise<readonly OwnerAccount[]>;
  deleteAccount(uid: string): Promise<void>;
}

export const OWNER_API: InjectionKey<OwnerApi> = Symbol('OwnerApi');

export const EMPTY_OWNER_API: OwnerApi = {
  setClanName: async () => {},
  setClanTag: async () => {},
  setApiToken: async () => {},
  getApiTokenStatus: async () => false,
  listAccounts: async () => [],
  deleteAccount: async () => {},
};

export function createOwnerApi(): OwnerApi {
  return {
    async setClanName(clanName: string) {
      const res = await fetch('/api/setClanName', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: clanName }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to update clan name');
      }
    },
    async setClanTag(clanTag: string) {
      const res = await fetch('/api/setClanTag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: clanTag }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to update clan tag');
      }
    },
    async setApiToken(token: string) {
      const res = await fetch('/api/setApiToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: token }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to update API token');
      }
    },
    async getApiTokenStatus() {
      const res = await fetch('/api/getApiTokenStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to fetch API token status');
      }
      const data = (await res.json()) as { hasToken: boolean };
      return data.hasToken;
    },
    async listAccounts() {
      const res = await fetch('/api/listAccounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to fetch accounts list');
      }
      return (await res.json()) as readonly OwnerAccount[];
    },
    async deleteAccount(uid: string) {
      const res = await fetch('/api/deleteAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Failed to delete account');
      }
    },
  };
}
