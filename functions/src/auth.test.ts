import { describe, it, expect, beforeAll } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Request, Response } from 'firebase-functions/v2/https';
import { sessionLogin, sessionLogout, verifyRequestSession } from './auth';

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
    const { req, res, status, headers } = createMockReqRes({ body: { idToken } });

    // sessionLogin is an HTTPS v2 function handler.
    // For standard onRequest, the direct function is exported.
    // We get the handler under the hood.
    const handler = typeof (sessionLogin as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
      ? (sessionLogin as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
      : sessionLogin;
    await handler(req, res);

    expect(status).toBe(200);
    expect(headers['set-cookie']).toBeDefined();
    expect(headers['set-cookie']).toContain('__session=');
    expect(headers['set-cookie']).toContain('HttpOnly');
    expect(headers['set-cookie']).toContain('Secure');
    expect(headers['set-cookie']).toContain('SameSite=Strict');
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

    const { req: logoutReq, res: logoutRes, status: logoutStatus, headers: logoutHeaders } = createMockReqRes({
      headers: { cookie: cookieValue },
    });

    const logoutHandler = typeof (sessionLogout as unknown as { run?: (req: Request, res: Response) => Promise<void> }).run === 'function'
      ? (sessionLogout as unknown as { run: (req: Request, res: Response) => Promise<void> }).run
      : sessionLogout;
    await logoutHandler(logoutReq, logoutRes);

    expect(logoutStatus).toBe(200);
    expect(logoutHeaders['set-cookie']).toBeDefined();
    // Max-Age=0 or Expires in past to clear the cookie
    expect(logoutHeaders['set-cookie']).toContain('Max-Age=0');

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
});
