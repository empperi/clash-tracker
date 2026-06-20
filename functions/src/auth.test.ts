import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { Request, Response } from 'firebase-functions/v2/https';
import { sessionLogin, sessionLogout, verifyRequestSession, findAccountForLogin, setMailerForTesting, setAccountRole } from './auth';

// Ensure emulator hosts are configured
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'militia-clash-tracker' }) : getApp();
const auth = getAuth(app);

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
  });

  it('sessionLogin exchanges ID token for session cookie and sets cookie header', async () => {
    const idToken = await getIdTokenForUid(testUid);
    const context = createMockReqRes({ body: { idToken } });

    // sessionLogin is an HTTPS v2 function handler.
    // For standard onRequest, the direct function is exported.
    // We get the handler under the hood.
    const handler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
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
    const loginHandler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
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
    const loginHandler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
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

    const logoutHandler = typeof (sessionLogout as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
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
    const loginHandler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
      ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
      : sessionLogin;
    await loginHandler(loginReq, loginMockRes.res);
    expect(loginMockRes.status).toBe(405);

    // Test logout
    const logoutReq = { method: 'GET' } as unknown as Request;
    const logoutMockRes = createMockReqRes({});
    const logoutHandler = typeof (sessionLogout as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
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
    const loginHandler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
      ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
      : sessionLogin;
    await loginHandler(context.req, context.res);

    expect(context.status).toBe(401);
    expect(context.body).toContain('Recent sign-in required');

    vi.useRealTimers();
  });
});

type FindAccountHandler = (req: {
  data: { usernameOrEmail: string };
  rawRequest?: { headers: { origin?: string } };
}) => Promise<{ status: string }>;

describe('findAccountForLogin callable', () => {
  const db = getFirestore(app);

  const sentEmails: { email: string; link: string }[] = [];
  const testMailer = {
    async sendSignInLink(email: string, link: string) {
      sentEmails.push({ email, link });
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
  });

  afterAll(async () => {
    // Clean up
    await db.collection('accounts').doc('john-doe-uid').delete();
  });

  beforeEach(() => {
    sentEmails.length = 0;
    setMailerForTesting(testMailer);
  });

  it('finds existing account by username (exact match)', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john_doe' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
    expect(sentEmails[0].link).toContain('%2Flogin');
  });

  it('finds existing account by username (case insensitive)', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'JOHN_DOE' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('finds existing account by email (exact match)', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'john.doe@example.com' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('finds existing account by email (case insensitive)', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'JOHN.DOE@EXAMPLE.COM' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].email).toBe('john.doe@example.com');
  });

  it('returns opaque response and does NOT send link for unknown username', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'nonexistent_user' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);
  });

  it('returns opaque response and does NOT send link for unknown email', async () => {
    const handler = typeof (findAccountForLogin as unknown as { run?: FindAccountHandler }).run === 'function'
      ? (findAccountForLogin as unknown as { run: FindAccountHandler }).run
      : (findAccountForLogin as unknown as FindAccountHandler);

    const result = await handler({ data: { usernameOrEmail: 'unknown@example.com' } });
    expect(result).toEqual({ status: 'ok' });
    expect(sentEmails).toHaveLength(0);
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
