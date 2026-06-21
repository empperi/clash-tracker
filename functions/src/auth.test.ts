import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Request, Response } from 'firebase-functions/v2/https';
import {
  sessionLogin,
  sessionLogout,
  verifyRequestSession,
  findAccountForLogin,
  verifyLoginOtp,
  setMailerForTesting,
  setAccountRole,
  requireRole,
  revokeAccountSessions,
  getMailer,
  handleFindAccountForLogin,
  handleVerifyLoginOtp,
  consoleMailer,
} from './auth';
import { hashOtp } from './crypto.js';

// Ensure emulator hosts are configured
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

const projectId = process.env.GCLOUD_PROJECT || 'militia-clash-tracker';
const app = getApps().length === 0 ? initializeApp({ projectId }) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Helper to exchange custom token for ID token via Auth emulator REST API
async function getIdTokenForUid(uid: string): Promise<string> {
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
  return data.idToken;
}

// Stub request/response helper
function createMockReqRes(reqData: { body?: unknown; headers?: Record<string, string> }) {
  const req = {
    method: 'POST',
    body: reqData.body,
    headers: reqData.headers || {},
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
    on() {
      return this;
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

describe('Session Authentication lifecycle', () => {
  const testUid = 'test-session-user';

  beforeAll(async () => {
    // Clean up or seed if needed
    try {
      await auth.deleteUser(testUid);
    } catch {
      // Ignored if user doesn't exist
    }
    await auth.createUser({ uid: testUid, email: 'test@example.com' });
    await db.collection('accounts').doc(testUid).set({
      username: 'session_tester',
      email: 'test@example.com',
      role: 'admin',
    });
  });

  afterAll(async () => {
    try {
      await auth.deleteUser(testUid);
    } catch {
      // Ignored
    }
    await db.collection('accounts').doc(testUid).delete();
  });

  it('sessionLogin exchanges ID token for session cookie and sets cookie header', async () => {
    const idToken = await getIdTokenForUid(testUid);
    const context = createMockReqRes({ body: { idToken } });

    // sessionLogin is an HTTPS v2 function handler.
    // For standard onRequest, the direct function is exported.
    // We get the handler under the hood.
    const handler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;
    await handler(context.req, context.res);

    expect(context.status).toBe(200);
    expect(context.headers['set-cookie']).toBeDefined();
    expect(context.headers['set-cookie']).toContain('__session=');
    expect(context.headers['set-cookie']).toContain('HttpOnly');
    expect(context.headers['set-cookie']).toContain('Secure');
    expect(context.headers['set-cookie']).toContain('SameSite=Strict');
  });

  it('authenticates subsequent request carrying the session cookie', async () => {
    const idToken = await getIdTokenForUid(testUid);
    const mockContext = createMockReqRes({ body: { idToken } });
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;
    await loginHandler(mockContext.req, mockContext.res);

    const setCookieHeader = mockContext.headers['set-cookie'];
    const cookieValue = setCookieHeader.split(';')[0]; // "__session=..."

    // Make an authenticated request containing the cookie
    const req = {
      headers: {
        cookie: cookieValue,
      },
    } as unknown as Request;

    const decoded = await verifyRequestSession(req);
    expect(decoded).not.toBeNull();
    expect(decoded!.uid).toBe(testUid);
  });

  it('sessionLogout clears cookie and revokes/invalidates session', async () => {
    const idToken = await getIdTokenForUid(testUid);
    const mockContext = createMockReqRes({ body: { idToken } });
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;
    await loginHandler(mockContext.req, mockContext.res);

    const setCookieHeader = mockContext.headers['set-cookie'];
    const cookieValue = setCookieHeader.split(';')[0]; // "__session=..."

    // Wait 1 second so that the revocation timestamp is strictly after the cookie's auth_time.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const logoutContext = createMockReqRes({
      headers: { cookie: cookieValue },
    });

    const logoutHandler =
      typeof (sessionLogout as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogout as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogout;
    await logoutHandler(logoutContext.req, logoutContext.res);

    expect(logoutContext.status).toBe(200);
    expect(logoutContext.headers['set-cookie']).toBeDefined();
    // Max-Age=0 or Expires in past to clear the cookie
    expect(logoutContext.headers['set-cookie']).toContain('Max-Age=0');

    // Subsequent verification must fail/return null
    const reqAfterLogout = {
      headers: {
        cookie: cookieValue,
      },
    } as unknown as Request;
    const decodedAfterLogout = await verifyRequestSession(reqAfterLogout);
    expect(decodedAfterLogout).toBeNull();
  });

  it('sessionLogin and sessionLogout reject non-POST requests with 405 Method Not Allowed', async () => {
    // Test login
    const loginReq = { method: 'GET' } as unknown as Request;
    const loginMockRes = createMockReqRes({});
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;
    await loginHandler(loginReq, loginMockRes.res);
    expect(loginMockRes.status).toBe(405);

    // Test logout
    const logoutReq = { method: 'GET' } as unknown as Request;
    const logoutMockRes = createMockReqRes({});
    const logoutHandler =
      typeof (sessionLogout as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogout as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogout;
    await logoutHandler(logoutReq, logoutMockRes.res);
    expect(logoutMockRes.status).toBe(405);
  });

  it('sessionLogin rejects ID tokens authenticated more than 5 minutes ago', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now());

    const idToken = await getIdTokenForUid(testUid);

    // Advance time by 6 minutes (360,000 ms)
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);

    const context = createMockReqRes({ body: { idToken } });
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;
    await loginHandler(context.req, context.res);

    expect(context.status).toBe(401);
    expect(context.body).toContain('Recent sign-in required');

    vi.useRealTimers();
  });

  it('sessionLogin rejects ID token if user has no Firestore account document and deletes the dangling Auth user', async () => {
    const danglingUid = 'dangling-test-user';
    try {
      await auth.deleteUser(danglingUid);
    } catch {
      // Ignored
    }

    // Create user in Auth
    await auth.createUser({ uid: danglingUid, email: 'dangling@example.com' });

    // Verify user exists in Auth
    const initialUser = await auth.getUser(danglingUid);
    expect(initialUser.uid).toBe(danglingUid);

    // Swap ID token
    const idToken = await getIdTokenForUid(danglingUid);

    // Call sessionLogin (should fail because no Firestore account exists)
    const context = createMockReqRes({ body: { idToken } });
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;

    await loginHandler(context.req, context.res);

    expect(context.status).toBe(401);
    expect(context.body).toContain('Unauthorized: No associated account.');

    // Verify user was cleaned up from Auth
    await expect(auth.getUser(danglingUid)).rejects.toThrow();
  });
});

type FindAccountHandler = (req: {
  data: { usernameOrEmail: string };
  rawRequest?: { headers: { origin?: string } };
}) => Promise<{ status: string }>;

describe('findAccountForLogin callable', () => {
  const db = getFirestore(app);

  const sentEmails: { email: string; link: string; code?: string }[] = [];
  const testMailer = {
    async sendSignInLink(email: string, link: string) {
      sentEmails.push({ email, link });
    },
    async sendSignInCode(email: string, options: { code: string; link: string }) {
      sentEmails.push({ email, link: options.link, code: options.code });
    },
  };

  beforeAll(async () => {
    // Seed test account
    await db.collection('accounts').doc('john-doe-uid').set({
      email: 'john.doe@example.com',
      username: 'john_doe',
      role: 'admin',
      playerTag: '#12345',
    });
    try {
      await auth.deleteUser('john-doe-uid');
    } catch {
      // Ignored
    }
    await auth.createUser({
      uid: 'john-doe-uid',
      email: 'john.doe@example.com',
    });
  });

  afterAll(async () => {
    // Clean up
    await db.collection('accounts').doc('john-doe-uid').delete();
    try {
      await auth.deleteUser('john-doe-uid');
    } catch {
      // Ignored
    }
  });

  beforeEach(() => {
    sentEmails.length = 0;
    setMailerForTesting(testMailer);
  });

  it('finds existing account by username (exact match)', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john_doe' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
    expect(sentEmails[0].link).toContain('%2Flogin');
  });

  it('finds existing account by username (case insensitive)', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'JOHN_DOE' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('finds existing account by email (exact match)', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john.doe@example.com' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('finds existing account by email (case insensitive)', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'JOHN.DOE@EXAMPLE.COM' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('returns opaque response and does NOT send link for unknown username', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'nonexistent_user' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);
  });

  it('returns opaque response and does NOT send link for unknown email', async () => {
    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'unknown@example.com' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);
  });

  it('does NOT send link if user exists in Firestore but has been deleted from Auth', async () => {
    const inconsistentUid = 'inconsistent-test-uid';
    await db.collection('accounts').doc(inconsistentUid).set({
      email: 'inconsistent@example.com',
      username: 'inconsistent_user',
      role: 'admin',
      playerTag: '#999',
    });

    try {
      await auth.deleteUser(inconsistentUid);
    } catch {
      // Ignored
    }

    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'inconsistent_user' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);

    await db.collection('accounts').doc(inconsistentUid).delete();
  });

  it('returns opaque response and does NOT throw if email link generation/sending fails', async () => {
    const failingMailer = {
      async sendSignInLink() {
        throw new Error('Mailer connection failed');
      },
      async sendSignInCode() {
        throw new Error('Mailer connection failed');
      },
    };
    setMailerForTesting(failingMailer);

    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john_doe' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);
  });

  it('generates OTP, hashes it, stores it in pendingLogins doc, and passes code + link to mailer for known account', async () => {
    await db.collection('pendingLogins').doc('john-doe-uid').delete();

    const handler =
      typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
        ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
        : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john_doe' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
    expect(sentEmails[0].code).toBeDefined();
    expect(sentEmails[0].code).toMatch(/^\d{6}$/);
    expect(sentEmails[0].link).toContain('%2Flogin');

    // Verify document exists in firestore emulator
    const docSnap = await db.collection('pendingLogins').doc('john-doe-uid').get();
    expect(docSnap.exists).toBe(true);
    const data = docSnap.data();
    expect(data?.hash).toBeDefined();
    expect(data?.attempts).toBe(0);
    expect(data?.expiresAt).toBeDefined();

    // Verify the hashed code is correct
    const pepper = process.env.OTP_PEPPER || '';
    const expectedHash = hashOtp(sentEmails[0].code!, 'john-doe-uid', pepper);
    expect(data?.hash).toBe(expectedHash);

    // Verify a second request overwrites the prior pending code
    sentEmails.length = 0;
    const result2 = await handler({ data: { usernameOrEmail: 'john_doe' } });
    expect(result2).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    const secondCode = sentEmails[0].code;
    expect(secondCode).toBeDefined();

    const docSnap2 = await db.collection('pendingLogins').doc('john-doe-uid').get();
    const data2 = docSnap2.data();
    const expectedHash2 = hashOtp(secondCode!, 'john-doe-uid', pepper);
    expect(data2?.hash).toBe(expectedHash2);

    // Clean up
    await db.collection('pendingLogins').doc('john-doe-uid').delete();
  });
});

describe('verifyLoginOtp callable', () => {
  const db = getFirestore(app);
  const uid = 'john-doe-uid';
  const pepper = process.env.OTP_PEPPER || '';

  type VerifyLoginOtpHandler = (req: {
    data: { usernameOrEmail: string; code: string };
  }) => Promise<{ customToken: string }>;

  beforeAll(async () => {
    // Seed account doc
    await db.collection('accounts').doc(uid).set({
      email: 'john.doe@example.com',
      username: 'john_doe',
      role: 'admin',
      playerTag: '#12345',
    });
    try {
      await auth.deleteUser(uid);
    } catch {
      // Ignored if user doesn't exist
    }
    await auth.createUser({
      uid,
      email: 'john.doe@example.com',
    });
  });

  afterAll(async () => {
    await db.collection('accounts').doc(uid).delete();
    try {
      await auth.deleteUser(uid);
    } catch {
      // Ignored
    }
  });

  beforeEach(async () => {
    await db.collection('pendingLogins').doc(uid).delete();
  });

  it('successfully verifies correct OTP, deletes pending document, and returns custom token', async () => {
    const code = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min future
    const hashed = hashOtp(code, uid, pepper);

    await db.collection('pendingLogins').doc(uid).set({
      hash: hashed,
      expiresAt,
      attempts: 0,
    });

    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    const result = await handler({ data: { usernameOrEmail: 'john_doe', code } });
    expect(result).toBeDefined();
    expect(result.customToken).toBeDefined();
    expect(typeof result.customToken).toBe('string');

    // Doc should be deleted
    const docSnap = await db.collection('pendingLogins').doc(uid).get();
    expect(docSnap.exists).toBe(false);
  });

  it('fails uniformly for incorrect OTP and increments attempt count', async () => {
    const code = '123456';
    const wrongCode = '654321';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const hashed = hashOtp(code, uid, pepper);

    await db.collection('pendingLogins').doc(uid).set({
      hash: hashed,
      expiresAt,
      attempts: 0,
    });

    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    await expect(
      handler({ data: { usernameOrEmail: 'john_doe', code: wrongCode } })
    ).rejects.toThrowError(/Invalid or expired code/);

    // Verify doc still exists but attempts are incremented
    const docSnap = await db.collection('pendingLogins').doc(uid).get();
    expect(docSnap.exists).toBe(true);
    expect(docSnap.data()?.attempts).toBe(1);
  });

  it('invalidates/deletes pending doc once the attempt cap (5) is reached', async () => {
    const code = '123456';
    const wrongCode = '654321';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const hashed = hashOtp(code, uid, pepper);

    // Seed doc with 4 attempts (the 5th failed attempt should trigger deletion)
    await db.collection('pendingLogins').doc(uid).set({
      hash: hashed,
      expiresAt,
      attempts: 4,
    });

    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    await expect(
      handler({ data: { usernameOrEmail: 'john_doe', code: wrongCode } })
    ).rejects.toThrowError(/Invalid or expired code/);

    // Verify doc is deleted (invalidated)
    const docSnap = await db.collection('pendingLogins').doc(uid).get();
    expect(docSnap.exists).toBe(false);
  });

  it('fails uniformly for expired OTP and deletes it', async () => {
    const code = '123456';
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min past
    const hashed = hashOtp(code, uid, pepper);

    await db.collection('pendingLogins').doc(uid).set({
      hash: hashed,
      expiresAt,
      attempts: 0,
    });

    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    await expect(handler({ data: { usernameOrEmail: 'john_doe', code } })).rejects.toThrowError(
      /Invalid or expired code/
    );

    const docSnap = await db.collection('pendingLogins').doc(uid).get();
    expect(docSnap.exists).toBe(false);
  });

  it('fails uniformly for unknown account and writes/modifies nothing', async () => {
    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    await expect(
      handler({ data: { usernameOrEmail: 'unknown_user', code: '123456' } })
    ).rejects.toThrowError(/Invalid or expired code/);
  });

  it('exchanges custom token from verifyLoginOtp at sessionLogin to yield valid session cookie (convergence)', async () => {
    const code = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const hashed = hashOtp(code, uid, pepper);

    await db.collection('pendingLogins').doc(uid).set({
      hash: hashed,
      expiresAt,
      attempts: 0,
    });

    const handler =
      typeof (verifyLoginOtp as unknown as { run?: VerifyLoginOtpHandler }).run === 'function'
        ? (verifyLoginOtp as unknown as { run: VerifyLoginOtpHandler }).run
        : (verifyLoginOtp as unknown as VerifyLoginOtpHandler);

    // 1. Verify code and get customToken
    const verifyResult = await handler({ data: { usernameOrEmail: 'john_doe', code } });
    expect(verifyResult).toBeDefined();
    expect(verifyResult.customToken).toBeDefined();

    // 2. Exchange customToken for ID token via Auth emulator REST API
    const exchangeUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=mock-key`;
    const exchangeRes = await fetch(exchangeUrl, {
      method: 'POST',
      body: JSON.stringify({ token: verifyResult.customToken, returnSecureToken: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(exchangeRes.ok).toBe(true);
    const exchangeData = (await exchangeRes.json()) as { idToken: string };
    const idToken = exchangeData.idToken;
    expect(idToken).toBeDefined();

    // 3. Exchange ID token for session cookie via sessionLogin
    const context = createMockReqRes({ body: { idToken } });
    const loginHandler =
      typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> })
        .run === 'function'
        ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
        : sessionLogin;

    await loginHandler(context.req, context.res);

    expect(context.status).toBe(200);
    expect(context.headers['set-cookie']).toBeDefined();
    expect(context.headers['set-cookie']).toContain('__session=');
  });
});

describe('setAccountRole primitive', () => {
  const db = getFirestore(app);
  const testUid = 'role-sync-test-uid';

  beforeAll(async () => {
    try {
      await auth.deleteUser(testUid);
    } catch {
      // Ignored
    }
    await auth.createUser({ uid: testUid, email: 'role-test@example.com' });
  });

  afterAll(async () => {
    try {
      await auth.deleteUser(testUid);
    } catch {
      // Ignored
    }
    await db.collection('accounts').doc(testUid).delete();
  });

  it('updates the role in Firestore and sets custom user claim in Auth', async () => {
    // 1. Seed initial document
    await db.collection('accounts').doc(testUid).set({
      username: 'role_tester',
      email: 'role-test@example.com',
      role: null,
      playerTag: '#TEST1',
    });

    // 2. Call setAccountRole
    await setAccountRole(testUid, 'admin');

    // 3. Assert Firestore was updated
    const doc = await db.collection('accounts').doc(testUid).get();
    expect(doc.data()?.role).toBe('admin');

    // 4. Assert custom claim was set in Auth
    const userRecord = await auth.getUser(testUid);
    expect(userRecord.customClaims).toEqual({ role: 'admin' });

    // 5. Call setAccountRole with null to clear
    await setAccountRole(testUid, null);

    // 6. Assert Firestore is updated to null
    const docNull = await db.collection('accounts').doc(testUid).get();
    expect(docNull.data()?.role).toBeNull();

    // 7. Assert custom claims are cleared
    const userRecordNull = await auth.getUser(testUid);
    expect(userRecordNull.customClaims || {}).toEqual({});
  });
});

describe('requireRole higher-order guard', () => {
  const mockDbOk = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true }),
      }),
    }),
  } as unknown as FirebaseFirestore.Firestore;

  it('rejects with unauthenticated (401) if cookie is missing', async () => {
    const mockHandler = vi.fn();
    const mockVerify = vi.fn();

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({ headers: {} });
    await guarded(context.req, context.res);

    expect(context.status).toBe(401);
    expect(context.body).toContain('Session cookie missing');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('rejects with unauthenticated (401) if verifySessionCookie fails', async () => {
    const mockHandler = vi.fn();
    const mockVerify = vi.fn().mockRejectedValue(new Error('Invalid token'));

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=bad-cookie',
      },
    });
    await guarded(context.req, context.res);

    expect(context.status).toBe(401);
    expect(context.body).toContain('Invalid or expired session');
    expect(mockVerify).toHaveBeenCalledWith('bad-cookie', true);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('rejects with forbidden (403) if role claim is missing or insufficient', async () => {
    const mockHandler = vi.fn();
    const mockVerify = vi
      .fn()
      .mockResolvedValue({ uid: 'user123', role: undefined } as unknown as DecodedIdToken);

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=good-cookie',
      },
    });
    await guarded(context.req, context.res);

    expect(context.status).toBe(403);
    expect(context.body).toContain('Insufficient permissions');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('allows request if role matches exactly', async () => {
    const mockHandler = vi.fn().mockImplementation(async (req, res) => {
      res.status(200).json({ result: 'success' });
    });
    const mockVerify = vi
      .fn()
      .mockResolvedValue({ uid: 'user123', role: 'admin' } as unknown as DecodedIdToken);

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=admin-cookie',
      },
    });
    await guarded(context.req, context.res);

    expect(context.status).toBe(200);
    expect(context.body).toEqual({ result: 'success' });
    expect(mockHandler).toHaveBeenCalled();
    const passedReq = mockHandler.mock.calls[0][0];
    expect(passedReq.auth).toBeDefined();
    expect(passedReq.auth.uid).toBe('user123');
    expect(passedReq.auth.token.role).toBe('admin');
  });

  it('allows owner if admin is required', async () => {
    const mockHandler = vi.fn().mockImplementation(async (req, res) => {
      res.status(200).json({ result: 'success' });
    });
    const mockVerify = vi
      .fn()
      .mockResolvedValue({ uid: 'user123', role: 'owner' } as unknown as DecodedIdToken);

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=owner-cookie',
      },
    });
    await guarded(context.req, context.res);

    expect(context.status).toBe(200);
    expect(context.body).toEqual({ result: 'success' });
    expect(mockHandler).toHaveBeenCalled();
  });

  it('rejects admin if owner is required', async () => {
    const mockHandler = vi.fn();
    const mockVerify = vi
      .fn()
      .mockResolvedValue({ uid: 'user123', role: 'admin' } as unknown as DecodedIdToken);

    const guarded = requireRole('owner', { verifySessionCookie: mockVerify, db: mockDbOk })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=admin-cookie',
      },
    });
    await guarded(context.req, context.res);

    expect(context.status).toBe(403);
    expect(context.body).toContain('Insufficient permissions');
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('clears session cookie and redirects if user account document does not exist in Firestore', async () => {
    const mockHandler = vi.fn();
    const mockVerify = vi
      .fn()
      .mockResolvedValue({ uid: 'deleted-uid', role: 'admin' } as unknown as DecodedIdToken);

    const mockDbMissing = {
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false }),
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore;

    const guarded = requireRole('admin', { verifySessionCookie: mockVerify, db: mockDbMissing })(
      mockHandler
    );

    const context = createMockReqRes({
      headers: {
        cookie: '__session=valid-but-deleted-cookie',
      },
    });

    await guarded(context.req, context.res);

    expect(context.status).toBe(302);
    expect(context.headers['location']).toBe('/');
    expect(context.headers['set-cookie']).toContain('__session=; Max-Age=0');
    expect(mockHandler).not.toHaveBeenCalled();
  });
});

describe('revokeAccountSessions helper', () => {
  it('calls auth.revokeRefreshTokens with the user uid', async () => {
    const mockRevoke = vi.fn().mockResolvedValue(undefined);
    const mockAuth = {
      revokeRefreshTokens: mockRevoke,
    };

    await revokeAccountSessions('user-to-revoke', { auth: mockAuth });

    expect(mockRevoke).toHaveBeenCalledWith('user-to-revoke');
  });
});

describe('Mailer selection and secrets validation', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns Resend mailer if RESEND_API_KEY is defined', () => {
    setMailerForTesting(consoleMailer);
    process.env.RESEND_API_KEY = 're_somekey';
    process.env.RESEND_SENDER = 'test@example.com';

    const mailer = getMailer();
    expect(mailer).toBeDefined();
    expect(mailer).not.toBe(consoleMailer);
  });

  it('returns consoleMailer if RESEND_API_KEY is not defined and not in production', () => {
    setMailerForTesting(consoleMailer);
    delete process.env.RESEND_API_KEY;
    delete process.env.FUNCTIONS_EMULATOR;
    // NODE_ENV is 'test' (set by vitest), so isProduction is false

    const mailer = getMailer();
    expect(mailer).toBe(consoleMailer);
  });

  it('throws loud error if RESEND_API_KEY is missing in production', () => {
    setMailerForTesting(consoleMailer);
    delete process.env.RESEND_API_KEY;
    delete process.env.FUNCTIONS_EMULATOR;
    process.env.NODE_ENV = 'production';

    expect(() => getMailer()).toThrowError(/RESEND_API_KEY is not configured in production/);
  });

  it('throws loud error in handleFindAccountForLogin if OTP_PEPPER is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.OTP_PEPPER;

    const mockDb = {} as unknown as FirebaseFirestore.Firestore;
    await expect(
      handleFindAccountForLogin('user', 'origin', {
        db: mockDb,
        auth: {} as unknown as {
          generateSignInWithEmailLink(
            email: string,
            settings: { url: string; handleCodeInApp: boolean }
          ): Promise<string>;
          getUser(uid: string): Promise<{ uid: string }>;
        },
        mailer: consoleMailer,
      })
    ).rejects.toThrowError(/OTP_PEPPER is not configured in production/);
  });

  it('throws loud error in handleVerifyLoginOtp if OTP_PEPPER is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.OTP_PEPPER;

    const mockDb = {} as unknown as FirebaseFirestore.Firestore;
    await expect(
      handleVerifyLoginOtp('user', '123456', {
        db: mockDb,
        auth: {} as unknown as { createCustomToken(uid: string): Promise<string> },
      })
    ).rejects.toThrowError(/OTP_PEPPER is not configured in production/);
  });
});
