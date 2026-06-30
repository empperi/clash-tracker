import type { InjectionKey } from 'vue';

export interface OwnerApi {
  setClanName(clanName: string): Promise<void>;
  setClanTag(clanTag: string): Promise<void>;
  setApiToken(token: string): Promise<void>;
  getApiTokenStatus(): Promise<boolean>;
}

export const OWNER_API: InjectionKey<OwnerApi> = Symbol('OwnerApi');

export const EMPTY_OWNER_API: OwnerApi = {
  setClanName: async () => {},
  setClanTag: async () => {},
  setApiToken: async () => {},
  getApiTokenStatus: async () => false,
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
  };
}
