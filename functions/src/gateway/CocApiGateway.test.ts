import { describe, it, expect } from 'vitest';
import { Result, ok, HttpClient, HttpResponse } from '@clash-tracker/core';
import { SecretsRepository } from '../repositories/SecretsRepository';
import { CocApiGateway } from './CocApiGateway';

class FakeHttpClient implements HttpClient {
  public lastUrl?: string;
  public lastHeaders?: Record<string, string>;

  constructor(
    public responseStatus: number = 200,
    public responseJson: unknown = {}
  ) {}

  async fetch(
    url: string,
    init?: { headers?: Record<string, string>; timeout?: number; method?: string }
  ): Promise<HttpResponse> {
    this.lastUrl = url;
    this.lastHeaders = init?.headers;
    return {
      status: this.responseStatus,
      json: async () => this.responseJson,
    };
  }
}

class FakeSecretsRepository {
  constructor(
    public token: string = 'fake-decrypted-token',
    public clanTag: string = '#2PGQYPQ'
  ) {}

  async getDecryptedToken(): Promise<Result<string, string>> {
    return ok(this.token);
  }

  async getClanTag(): Promise<Result<string, string>> {
    return ok(this.clanTag);
  }
}

describe('CocApiGateway', () => {
  const dummyClanTag = '#2PGQYPQ';
  const dummyBaseUrl = 'https://api.clashofclans.com/v1';

  it('should call getClan with correct URL and Authorization header', async () => {
    const fakeClient = new FakeHttpClient(200, {
      memberList: [{ tag: '#M1', name: 'Player1', role: 'leader', townHallLevel: 16 }],
    });
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      fakeClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getClan(dummyClanTag);
    expect(result.success).toBe(true);
    expect(fakeClient.lastUrl).toBe('https://api.clashofclans.com/v1/clans/%232PGQYPQ');
    expect(fakeClient.lastHeaders?.['Authorization']).toBe('Bearer token123');

    if (result.success) {
      expect(result.value.length).toBe(1);
      expect(result.value[0].name).toBe('Player1');
    }
  });

  it('should call getCurrentWar with correct URL', async () => {
    const fakeClient = new FakeHttpClient(200, {
      state: 'inWar',
      teamSize: 5,
      opponent: { name: 'Opponent Clan', tag: '#OPP1' },
    });
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      fakeClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getCurrentWar(dummyClanTag);
    expect(result.success).toBe(true);
    expect(fakeClient.lastUrl).toBe('https://api.clashofclans.com/v1/clans/%232PGQYPQ/currentwar');

    if (result.success) {
      expect(result.value.state).toBe('inWar');
      expect(result.value.opponentName).toBe('Opponent Clan');
    }
  });

  it('should map HTTP error status code to classified CocApiError', async () => {
    const fakeClient = new FakeHttpClient(429, {});
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      fakeClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getClan(dummyClanTag);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('RateLimited');
    }
  });

  it('should map 403 status to IpNotWhitelisted', async () => {
    const fakeClient = new FakeHttpClient(403, {});
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      fakeClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getCurrentWar(dummyClanTag);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('IpNotWhitelisted');
    }
  });

  it('should return Unknown if the secrets repository fails to return the decrypted token', async () => {
    class FailingSecretsRepository {
      async getDecryptedToken(): Promise<Result<string, string>> {
        return { success: false, error: 'Database connection failed' };
      }
      async getClanTag(): Promise<Result<string, string>> {
        return { success: false, error: 'Database connection failed' };
      }
    }
    const fakeClient = new FakeHttpClient();
    const gateway = new CocApiGateway(
      fakeClient,
      new FailingSecretsRepository() as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getClan(dummyClanTag);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown');
    }
  });

  it('should return Unknown if the httpClient fetch throws an error', async () => {
    const throwingHttpClient: HttpClient = {
      fetch: async () => {
        throw new Error('Network error');
      },
    };
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      throwingHttpClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl
    );

    const result = await gateway.getClan(dummyClanTag);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown');
    }
  });

  it('should pass timeout to httpClient and handle slow response abort', async () => {
    let passedTimeout: number | undefined;
    const fakeSlowClient: HttpClient = {
      fetch: async (url, init) => {
        passedTimeout = init?.timeout;
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('The operation was aborted.'));
          }, 10);
        });
      },
    };
    const fakeRepo = new FakeSecretsRepository('token123');
    const gateway = new CocApiGateway(
      fakeSlowClient,
      fakeRepo as unknown as SecretsRepository,
      dummyBaseUrl,
      50
    );

    const result = await gateway.getClan(dummyClanTag);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Unknown');
    }
    expect(passedTimeout).toBe(50);
  });

  const liveTest = process.env.COC_LIVE_TEST === '1' ? it : it.skip;

  liveTest('should hit real API and return members if COC_LIVE_TEST=1', async () => {
    const realHttpClient: HttpClient = {
      fetch: async (url, init) => {
        const controller = init?.timeout ? new AbortController() : null;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (controller && init?.timeout) {
          timeoutId = setTimeout(() => controller.abort(), init.timeout);
        }
        try {
          const res = await fetch(url, {
            method: init?.method || 'GET',
            headers: init?.headers,
            signal: controller?.signal,
          });
          return {
            status: res.status,
            json: () => res.json(),
          };
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      },
    };

    const realToken = process.env.CLASH_TOKEN;
    const realClanTag = process.env.CLAN_TAG || '#2PGQYPQ';

    expect(realToken).toBeDefined();
    if (!realToken) return;

    class SimpleFakeRepo {
      async getDecryptedToken() {
        return ok(realToken!);
      }
    }

    const gateway = new CocApiGateway(
      realHttpClient,
      new SimpleFakeRepo() as unknown as SecretsRepository
    );
    const result = await gateway.getClan(realClanTag);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.length).toBeGreaterThan(0);
    }
  });
});
