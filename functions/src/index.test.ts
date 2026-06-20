import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { Result, ok } from '@clash-tracker/core';
import { IngestSummary } from './use-cases/ingestCurrentWar';
import { RecomputeSummary } from './use-cases/recomputePlayerStats';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { setAccountRole } from './auth.js';
import { SecretsRepository } from './repositories/SecretsRepository';
import { parseEncryptionKey } from './crypto';
import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

type IngestUseCase = (clanTag: string) => Promise<Result<IngestSummary, string>>;
type RecomputeUseCase = () => Promise<Result<RecomputeSummary, string>>;

// A recompute spy that records whether it ran.
function recomputeSpy(
  result: Result<RecomputeSummary, string> = ok({ playersUpserted: 0, current: 0, past: 0 })
) {
  const state = { called: false };
  const fn: RecomputeUseCase = async () => {
    state.called = true;
    return result;
  };
  return { fn, state };
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'militia-clash-tracker' }) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

describe('Cloud Function handlers delegation', () => {
  const encKeyStr = '0123456789abcdef0123456789abcdef'; // 32 bytes UTF-8
  const encryptionKey = parseEncryptionKey(encKeyStr);
  const secretsRepo = new SecretsRepository(db, encryptionKey);

  let handleScheduledIngest: (
    ingestUseCase?: IngestUseCase,
    recomputeUseCase?: RecomputeUseCase
  ) => Promise<void>;
  let handleTriggerIngestNow: (
    ingestUseCase?: IngestUseCase,
    recomputeUseCase?: RecomputeUseCase
  ) => Promise<{ success: boolean; syncState?: string; error?: string }>;
  let triggerIngestNow: {
    (request: unknown): Promise<unknown>;
    run?: (request: unknown) => Promise<unknown>;
  };
  let mod: typeof import('./index');

  beforeAll(async () => {
    mod = await import('./index');
    handleScheduledIngest = mod.handleScheduledIngest;
    handleTriggerIngestNow = mod.handleTriggerIngestNow;
    triggerIngestNow = mod.triggerIngestNow;
  });

  beforeEach(async () => {
    process.env.CLASH_TOKEN_ENC_KEY = encKeyStr;
    await secretsRepo.setClanTag('#2PGQYPQ');
  });

  it('handleScheduledIngest should fetch clan tag and call use case', async () => {
    let calledClanTag = '';
    const mockIngest = async (clanTag: string): Promise<Result<IngestSummary, string>> => {
      calledClanTag = clanTag;
      return ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    };

    const recompute = recomputeSpy();
    await handleScheduledIngest(mockIngest, recompute.fn);
    expect(calledClanTag).toBe('#2PGQYPQ');
  });

  it('handleScheduledIngest recomputes player stats after a successful ingest', async () => {
    const mockIngest: IngestUseCase = async () =>
      ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    const recompute = recomputeSpy();

    await handleScheduledIngest(mockIngest, recompute.fn);
    expect(recompute.state.called).toBe(true);
  });

  it('handleScheduledIngest does NOT recompute when the ingest fails', async () => {
    const mockIngest: IngestUseCase = async () => ({ success: false, error: 'maintenance' });
    const recompute = recomputeSpy();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest(mockIngest, recompute.fn);
    consoleSpy.mockRestore();
    expect(recompute.state.called).toBe(false);
  });

  it('handleScheduledIngest should log an error if use case returns failure', async () => {
    const mockIngest = async (): Promise<Result<IngestSummary, string>> => {
      return { success: false, error: 'CoC API maintenance' };
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest(mockIngest);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scheduled ingestion failed: CoC API maintenance')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should print error if CLASH_TOKEN_ENC_KEY is missing', async () => {
    delete process.env.CLASH_TOKEN_ENC_KEY;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLASH_TOKEN_ENC_KEY is not configured.')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should print error if CLASH_TOKEN_ENC_KEY is invalid', async () => {
    process.env.CLASH_TOKEN_ENC_KEY = 'invalid-key';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot run scheduled ingest: Invalid encryption key.')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should log error if clan tag is not configured in repo', async () => {
    await db.doc('secrets/coc').delete();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot run scheduled ingest: No secrets found')
    );
    consoleSpy.mockRestore();
  });

  it('handleTriggerIngestNow should fetch clan tag, call use case, and return status', async () => {
    let calledClanTag = '';
    const mockIngest = async (clanTag: string): Promise<Result<IngestSummary, string>> => {
      calledClanTag = clanTag;
      return ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    };

    const recompute = recomputeSpy();
    const res = await handleTriggerIngestNow(mockIngest, recompute.fn);
    expect(calledClanTag).toBe('#2PGQYPQ');
    expect(res.success).toBe(true);
    expect(res.syncState).toBe('synced');
    expect(recompute.state.called).toBe(true);
  });

  it('handleTriggerIngestNow still returns success when recompute fails (logged, not fatal)', async () => {
    const mockIngest: IngestUseCase = async () =>
      ok({ status: 'synced', warId: 'war123', attacksAdded: 1 });
    const recompute = recomputeSpy({ success: false, error: 'recompute boom' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleTriggerIngestNow(mockIngest, recompute.fn);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('recompute boom'));
    consoleSpy.mockRestore();
    expect(res.success).toBe(true);
  });

  it('handleTriggerIngestNow should return success: false if use case fails', async () => {
    const mockIngest = async (): Promise<Result<IngestSummary, string>> => {
      return { success: false, error: 'CoC API error 503' };
    };

    const res = await handleTriggerIngestNow(mockIngest);
    expect(res.success).toBe(false);
    expect(res.error).toBe('CoC API error 503');
  });

  it('handleTriggerIngestNow should throw HttpsError if CLASH_TOKEN_ENC_KEY is missing', async () => {
    delete process.env.CLASH_TOKEN_ENC_KEY;
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: 'CLASH_TOKEN_ENC_KEY is not configured.',
      })
    );
  });

  it('handleTriggerIngestNow should throw HttpsError if CLASH_TOKEN_ENC_KEY is invalid', async () => {
    process.env.CLASH_TOKEN_ENC_KEY = 'invalid-key';
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('Invalid encryption key'),
      })
    );
  });

  it('handleTriggerIngestNow should throw HttpsError if clan tag is missing', async () => {
    await db.doc('secrets/coc').delete();
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('Clan tag not configured'),
      })
    );
  });

  describe('triggerIngestNow role gating', () => {
    const testAdminUid = 'test-admin-ingest';
    const testMemberUid = 'test-member-ingest';

    afterAll(async () => {
      try {
        await auth.deleteUser(testAdminUid);
      } catch {
        // Ignored
      }
      try {
        await auth.deleteUser(testMemberUid);
      } catch {
        // Ignored
      }
      await db.collection('accounts').doc(testAdminUid).delete();
      await db.collection('accounts').doc(testMemberUid).delete();
    });

    async function getSessionCookieForUser(uid: string, role: 'admin' | 'member' | null): Promise<string> {
      try {
        await auth.deleteUser(uid);
      } catch {
        // Ignored
      }
      await auth.createUser({ uid, email: `${uid}@example.com` });

      await db.collection('accounts').doc(uid).set({
        username: `${uid}_user`,
        email: `${uid}@example.com`,
        role: null,
        playerTag: '#TEST1',
      });

      if (role === 'member') {
        // Set the custom claim directly to 'member' to test negative access role gating,
        // avoiding typescript compiler errors for unprivileged roles.
        await auth.setCustomUserClaims(uid, { role: 'member' });
      } else {
        await setAccountRole(uid, role);
      }

      const customToken = await auth.createCustomToken(uid);
      const url = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=mock-key`;
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to exchange custom token: ${await res.text()}`);
      }
      const data = (await res.json()) as { idToken: string };
      const idToken = data.idToken;

      const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: 1000 * 60 * 60 * 24 * 5,
      });
      return sessionCookie;
    }

    function createMockReqRes(reqData: { headers?: Record<string, string>; method?: string }) {
      const req = {
        method: reqData.method || 'POST',
        headers: reqData.headers || {},
      } as unknown as Request;

      let resStatus = 200;
      let resBody: unknown = null;

      const res = {
        status(code: number) {
          resStatus = code;
          return this;
        },
        send(body: unknown) {
          resBody = body;
        },
        json(body: unknown) {
          resBody = body;
        },
      } as unknown as Response;

      return {
        req,
        res,
        get status() {
          return resStatus;
        },
        get body() {
          return resBody;
        },
      };
    }

    it('rejects non-POST requests with 405 Method Not Allowed', async () => {
      const handler =
        typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
      const context = createMockReqRes({
        method: 'GET',
        headers: {
          cookie: '__session=admin-cookie',
        },
      });
      await handler(context.req, context.res);

      expect(context.status).toBe(405);
      expect(context.body).toContain('Method Not Allowed');
    });

    it('rejects if cookie is missing', async () => {
      const handler =
        typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
      const context = createMockReqRes({ headers: {} });
      await handler(context.req, context.res);

      expect(context.status).toBe(401);
      expect(context.body).toContain('Session cookie missing.');
    });

    it('rejects if cookie is invalid', async () => {
      const handler =
        typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
      const context = createMockReqRes({
        headers: {
          cookie: '__session=invalid-cookie-value',
        },
      });
      await handler(context.req, context.res);

      expect(context.status).toBe(401);
      expect(context.body).toContain('Invalid or expired session');
    });

    it('rejects if role is insufficient', async () => {
      const handler =
        typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
      
      const cookie = await getSessionCookieForUser(testMemberUid, 'member');

      const context = createMockReqRes({
        headers: {
          cookie: `__session=${cookie}`,
        },
      });
      await handler(context.req, context.res);

      expect(context.status).toBe(403);
      expect(context.body).toContain('Insufficient permissions.');
    });

    it('allows request if role is admin', async () => {
      const handler =
        typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
      
      const mockIngest = async (): Promise<Result<IngestSummary, string>> => {
        return ok({ status: 'synced', warId: 'war123', attacksAdded: 1 });
      };
      const recompute = recomputeSpy();

      mod.setIngestUseCaseForTesting(mockIngest);
      mod.setRecomputeUseCaseForTesting(recompute.fn);

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');

      const context = createMockReqRes({
        headers: {
          cookie: `__session=${cookie}`,
        },
      });
      await handler(context.req, context.res);

      expect(context.status).toBe(200);
      expect(context.body).toEqual({ success: true, syncState: 'synced' });
      expect(recompute.state.called).toBe(true);

      mod.setIngestUseCaseForTesting(undefined);
      mod.setRecomputeUseCaseForTesting(undefined);
    });
  });
});
