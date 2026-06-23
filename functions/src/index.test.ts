import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { Result, ok } from '@clash-tracker/core';
import { IngestSummary } from './use-cases/ingestCurrentWar';
import { RecomputeSummary } from './use-cases/recomputePlayerStats';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { setAccountRole, setMailerForTesting } from './auth.js';
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

const projectId = process.env.GCLOUD_PROJECT || 'militia-clash-tracker';
const app = getApps().length === 0 ? initializeApp({ projectId }) : getApp();
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
  let setThreshold: {
    (request: Request, response: Response): Promise<void> | void;
    run?: (request: Request, response: Response) => Promise<void> | void;
  };
  let inviteAdmin: {
    (request: Request, response: Response): Promise<void> | void;
    run?: (request: Request, response: Response) => Promise<void> | void;
  };
  let listPendingInvites: {
    (request: Request, response: Response): Promise<void> | void;
    run?: (request: Request, response: Response) => Promise<void> | void;
  };
  let revokeInvite: {
    (request: Request, response: Response): Promise<void> | void;
    run?: (request: Request, response: Response) => Promise<void> | void;
  };
  let mod: typeof import('./index');

  beforeAll(async () => {
    mod = await import('./index');
    handleScheduledIngest = mod.handleScheduledIngest;
    handleTriggerIngestNow = mod.handleTriggerIngestNow;
    triggerIngestNow = mod.triggerIngestNow;
    setThreshold = mod.setThreshold;
    inviteAdmin = mod.inviteAdmin;
    listPendingInvites = mod.listPendingInvites;
    revokeInvite = mod.revokeInvite;
  });

  beforeEach(async () => {
    process.env.CLASH_TOKEN_ENC_KEY = encKeyStr;
    await secretsRepo.setClanTag('#2PGQYPQ');
  });

  async function getSessionCookieForUser(
    uid: string,
    role: 'admin' | 'member' | null
  ): Promise<string> {
    try {
      await auth.deleteUser(uid);
    } catch {
      // Ignored
    }
    await auth.createUser({ uid, email: `${uid}@example.com` });

    await db
      .collection('accounts')
      .doc(uid)
      .set({
        username: `${uid}_user`,
        email: `${uid}@example.com`,
        role: null,
        playerTag: '#TEST1',
      });

    if (role === 'member') {
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

  function createMockReqRes(reqData: { headers?: Record<string, string>; method?: string; body?: unknown }) {
    const req = {
      method: reqData.method || 'POST',
      headers: reqData.headers || {},
      body: reqData.body || {},
    } as unknown as Request;

    let resStatus = 200;
    const resHeaders: Record<string, string> = {};
    let resBody: unknown = null;

    const res = {
      status(code: number) {
        resStatus = code;
        return this;
      },
      setHeader(name: string, value: string) {
        resHeaders[name.toLowerCase()] = value;
        return this;
      },
      send(body: unknown) {
        resBody = body;
      },
      json(body: unknown) {
        resBody = body;
      },
      redirect(statusOrUrl: number | string, maybeUrl?: string) {
        if (typeof statusOrUrl === 'number') {
          resStatus = statusOrUrl;
          resHeaders['location'] = maybeUrl || '';
        } else {
          resStatus = 302;
          resHeaders['location'] = statusOrUrl;
        }
      },
    } as unknown as Response;

    return {
      req,
      res,
      get status() {
        return resStatus;
      },
      get headers() {
        return resHeaders;
      },
      get body() {
        return resBody;
      },
    };
  }

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

  describe('setThreshold', () => {
    const testAdminUid = 'test-admin-threshold';
    const testMemberUid = 'test-member-threshold';

    beforeAll(async () => {
      try { await auth.deleteUser(testAdminUid); } catch { /* Ignored */ }
      try { await auth.deleteUser(testMemberUid); } catch { /* Ignored */ }
    });

    afterAll(async () => {
      try { await auth.deleteUser(testAdminUid); } catch { /* Ignored */ }
      try { await auth.deleteUser(testMemberUid); } catch { /* Ignored */ }
      await db.collection('accounts').doc(testAdminUid).delete();
      await db.collection('accounts').doc(testMemberUid).delete();
      await db.collection('publicSettings').doc('config').delete();
    });

    it('rejects non-POST requests with 405 Method Not Allowed', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const context = createMockReqRes({
        method: 'GET',
        headers: { cookie: '__session=admin-cookie' }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(405);
      expect(context.body).toContain('Method Not Allowed');
    });

    it('rejects if cookie is missing', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const context = createMockReqRes({ headers: {}, method: 'POST' });
      await handler(context.req, context.res);
      expect(context.status).toBe(401);
      expect(context.body).toContain('Session cookie missing.');
    });

    it('rejects if role is insufficient', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testMemberUid, 'member');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'acceptancePct', value: 80 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(403);
      expect(context.body).toContain('Insufficient permissions.');
    });

    it('rejects invalid fields', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'invalidField', value: 80 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(400);
      expect(context.body).toContain('Invalid field');
    });

    it('rejects out of range validation for acceptancePct', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'acceptancePct', value: 150 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(400);
      expect(context.body).toContain('Acceptance percentage must be');
    });

    it('rejects out of range validation for minWarParticipation', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'minWarParticipation', value: -5 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(400);
      expect(context.body).toContain('Minimum war participation must be');
    });

    it('saves valid acceptancePct to Firestore config doc', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'acceptancePct', value: 85 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(200);
      expect(context.body).toEqual({ status: 'success' });

      const configDoc = await db.collection('publicSettings').doc('config').get();
      expect(configDoc.exists).toBe(true);
      expect(configDoc.data()?.acceptancePct).toBe(85);
    });

    it('saves valid minWarParticipation to Firestore config doc', async () => {
      const handler = typeof setThreshold.run === 'function' ? setThreshold.run : setThreshold;
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { field: 'minWarParticipation', value: 5 }
      });
      await handler(context.req, context.res);
      expect(context.status).toBe(200);
      expect(context.body).toEqual({ status: 'success' });

      const configDoc = await db.collection('publicSettings').doc('config').get();
      expect(configDoc.exists).toBe(true);
      expect(configDoc.data()?.minWarParticipation).toBe(5);
    });
  });

  describe('inviteAdmin endpoint', () => {
    let inviteAdminHandler: (req: Request, res: Response) => Promise<void> | void;
    const testAdminUid = 'admin-user-invite';
    const testMemberUid = 'member-user-invite';

    beforeAll(() => {
      inviteAdminHandler = typeof inviteAdmin.run === 'function' ? inviteAdmin.run : inviteAdmin;
    });

    beforeEach(async () => {
      const pendingAccounts = await db.collection('pendingAccounts').get();
      for (const doc of pendingAccounts.docs) {
        await doc.ref.delete();
      }
      // Only delete accounts created by these tests to avoid database collision with auth.test.ts
      await db.collection('accounts').doc(testAdminUid).delete();
      await db.collection('accounts').doc(testMemberUid).delete();
      await db.collection('accounts').doc('existing-uid').delete();
    });

    it('rejects if method is not POST', async () => {
      const context = createMockReqRes({ method: 'GET' });
      await inviteAdminHandler(context.req, context.res);
      expect(context.status).toBe(405);
      expect(context.body).toContain('Method Not Allowed');
    });

    it('rejects if session cookie is missing', async () => {
      const context = createMockReqRes({ method: 'POST', body: { email: 'test@example.com' } });
      await inviteAdminHandler(context.req, context.res);
      expect(context.status).toBe(401);
      expect(context.body).toContain('Session cookie missing.');
    });

    it('rejects if role is insufficient', async () => {
      const cookie = await getSessionCookieForUser(testMemberUid, 'member');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'test@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);
      expect(context.status).toBe(403);
      expect(context.body).toContain('Insufficient permissions.');
    });

    it('rejects invalid email formats', async () => {
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'invalid-email' }
      });
      await inviteAdminHandler(context.req, context.res);
      expect(context.status).toBe(400);
      expect(context.body).toContain('Invalid email format');
    });

    it('successfully invites a new admin, creating a pending account and sending email', async () => {
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const mockMailer = {
        sendSignInLink: vi.fn(),
        sendSignInCode: vi.fn(),
        sendInvitation: vi.fn().mockResolvedValue(undefined),
      };
      setMailerForTesting(mockMailer);

      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}`, origin: 'http://my-origin.com' },
        body: { email: 'new-admin@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);

      expect(context.status).toBe(200);
      const resBody = context.body as { status: string; inviteId: string };
      expect(resBody.status).toBe('success');
      expect(resBody.inviteId).toBeDefined();

      const pendingDoc = await db.collection('pendingAccounts').doc(resBody.inviteId).get();
      expect(pendingDoc.exists).toBe(true);
      const data = pendingDoc.data();
      expect(data?.email).toBe('new-admin@example.com');
      expect(data?.role).toBe('admin');
      expect(data?.createdAt).toBeDefined();

      expect(mockMailer.sendInvitation).toHaveBeenCalledTimes(1);
      expect(mockMailer.sendInvitation).toHaveBeenCalledWith('new-admin@example.com', {
        inviteId: resBody.inviteId,
        link: `http://my-origin.com/register?inviteId=${resBody.inviteId}`,
      });
    });

    it('rejects if user is already registered in accounts collection', async () => {
      await db.collection('accounts').doc('existing-uid').set({
        username: 'existing_user',
        email: 'registered@example.com',
        role: 'admin',
      });

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'registered@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);

      expect(context.status).toBe(409);
      expect(context.body).toContain('User is already registered with this email');
    });

    it('rejects if email already has an active pending invitation', async () => {
      await db.collection('pendingAccounts').doc('active-invite-id').set({
        email: 'pending@example.com',
        role: 'admin',
        createdAt: new Date(),
      });

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'pending@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);

      expect(context.status).toBe(409);
      expect(context.body).toContain('Email is already invited');
    });

    it('prunes expired pending invitation and succeeds if invitation exists but is expired', async () => {
      const expiredDate = new Date(Date.now() - 31 * 60 * 1000);
      const expiredDocRef = db.collection('pendingAccounts').doc('expired-invite-id');
      await expiredDocRef.set({
        email: 'expired-pending@example.com',
        role: 'admin',
        createdAt: expiredDate,
      });

      const mockMailer = {
        sendSignInLink: vi.fn(),
        sendSignInCode: vi.fn(),
        sendInvitation: vi.fn().mockResolvedValue(undefined),
      };
      setMailerForTesting(mockMailer);

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'expired-pending@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);

      expect(context.status).toBe(200);

      const oldDoc = await db.collection('pendingAccounts').doc('expired-invite-id').get();
      expect(oldDoc.exists).toBe(false);

      const resBody = context.body as { status: string; inviteId: string };
      const newDoc = await db.collection('pendingAccounts').doc(resBody.inviteId).get();
      expect(newDoc.exists).toBe(true);
      expect(newDoc.data()?.email).toBe('expired-pending@example.com');
    });

    it('deletes the pendingAccounts document if mailer.sendInvitation throws an error', async () => {
      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const mockMailer = {
        sendSignInLink: vi.fn(),
        sendSignInCode: vi.fn(),
        sendInvitation: vi.fn().mockRejectedValue(new Error('SMTP failure')),
      };
      setMailerForTesting(mockMailer);

      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { email: 'fail-email@example.com' }
      });
      await inviteAdminHandler(context.req, context.res);

      expect(context.status).toBe(500);
      expect(context.body).toContain('SMTP failure');

      const pendingAccounts = await db.collection('pendingAccounts').get();
      expect(pendingAccounts.empty).toBe(true);
    });
  });

  describe('listPendingInvites endpoint', () => {
    let listPendingInvitesHandler: (req: Request, res: Response) => Promise<void> | void;
    const testAdminUid = 'admin-user-list';
    const testMemberUid = 'member-user-list';

    beforeAll(() => {
      listPendingInvitesHandler = typeof listPendingInvites.run === 'function' ? listPendingInvites.run : listPendingInvites;
    });

    beforeEach(async () => {
      const pendingAccounts = await db.collection('pendingAccounts').get();
      for (const doc of pendingAccounts.docs) {
        await doc.ref.delete();
      }
      await db.collection('accounts').doc(testAdminUid).delete();
      await db.collection('accounts').doc(testMemberUid).delete();
    });

    it('rejects if session cookie is missing', async () => {
      const context = createMockReqRes({ method: 'GET' });
      await listPendingInvitesHandler(context.req, context.res);
      expect(context.status).toBe(401);
      expect(context.body).toContain('Session cookie missing.');
    });

    it('rejects if role is insufficient', async () => {
      const cookie = await getSessionCookieForUser(testMemberUid, 'member');
      const context = createMockReqRes({
        method: 'GET',
        headers: { cookie: `__session=${cookie}` }
      });
      await listPendingInvitesHandler(context.req, context.res);
      expect(context.status).toBe(403);
      expect(context.body).toContain('Insufficient permissions.');
    });

    it('returns a list of pending invitations with active and expired statuses', async () => {
      const now = new Date();
      const activeDate = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago (active)
      const expiredDate = new Date(now.getTime() - 35 * 60 * 1000); // 35 min ago (expired)

      await db.collection('pendingAccounts').doc('active-id').set({
        email: 'active@example.com',
        role: 'admin',
        createdAt: activeDate,
      });

      await db.collection('pendingAccounts').doc('expired-id').set({
        email: 'expired@example.com',
        role: 'admin',
        createdAt: expiredDate,
      });

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'GET',
        headers: { cookie: `__session=${cookie}` }
      });
      await listPendingInvitesHandler(context.req, context.res);

      expect(context.status).toBe(200);

      interface InviteItem {
        id: string;
        email: string;
        role: string;
        createdAt: string;
        expired: boolean;
      }

      const list = context.body as InviteItem[];
      expect(list).toHaveLength(2);

      const activeInvite = list.find((i) => i.id === 'active-id');
      expect(activeInvite).toBeDefined();
      expect(activeInvite.email).toBe('active@example.com');
      expect(activeInvite.expired).toBe(false);

      const expiredInvite = list.find((i) => i.id === 'expired-id');
      expect(expiredInvite).toBeDefined();
      expect(expiredInvite.email).toBe('expired@example.com');
      expect(expiredInvite.expired).toBe(true);
    });
  });

  describe('revokeInvite endpoint', () => {
    let revokeInviteHandler: (req: Request, res: Response) => Promise<void> | void;
    const testAdminUid = 'admin-user-revoke';
    const testMemberUid = 'member-user-revoke';

    beforeAll(() => {
      revokeInviteHandler = typeof revokeInvite.run === 'function' ? revokeInvite.run : revokeInvite;
    });

    beforeEach(async () => {
      const pendingAccounts = await db.collection('pendingAccounts').get();
      for (const doc of pendingAccounts.docs) {
        await doc.ref.delete();
      }
      await db.collection('accounts').doc(testAdminUid).delete();
      await db.collection('accounts').doc(testMemberUid).delete();
    });

    it('rejects if method is not POST', async () => {
      const context = createMockReqRes({ method: 'GET' });
      await revokeInviteHandler(context.req, context.res);
      expect(context.status).toBe(405);
      expect(context.body).toContain('Method Not Allowed');
    });

    it('rejects if session cookie is missing', async () => {
      const context = createMockReqRes({ method: 'POST', body: { id: 'some-id' } });
      await revokeInviteHandler(context.req, context.res);
      expect(context.status).toBe(401);
      expect(context.body).toContain('Session cookie missing.');
    });

    it('rejects if role is insufficient', async () => {
      const cookie = await getSessionCookieForUser(testMemberUid, 'member');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { id: 'some-id' }
      });
      await revokeInviteHandler(context.req, context.res);
      expect(context.status).toBe(403);
      expect(context.body).toContain('Insufficient permissions.');
    });

    it('successfully deletes/revokes the pending invitation document', async () => {
      await db.collection('pendingAccounts').doc('to-revoke-id').set({
        email: 'revoke-me@example.com',
        role: 'admin',
        createdAt: new Date(),
      });

      const cookie = await getSessionCookieForUser(testAdminUid, 'admin');
      const context = createMockReqRes({
        method: 'POST',
        headers: { cookie: `__session=${cookie}` },
        body: { id: 'to-revoke-id' }
      });
      await revokeInviteHandler(context.req, context.res);

      expect(context.status).toBe(200);
      expect(context.body).toEqual({ status: 'success' });

      const doc = await db.collection('pendingAccounts').doc('to-revoke-id').get();
      expect(doc.exists).toBe(false);
    });
  });
});
