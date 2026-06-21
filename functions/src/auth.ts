import { onRequest, onCall, HttpsError, Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { UserRole } from '@clash-tracker/core';
import crypto from 'node:crypto';
import { PendingLoginRepository } from './repositories/PendingLoginRepository.js';
import { generateOtp, hashOtp } from './crypto.js';

// Region is set per-function (not via setGlobalOptions) because this module is evaluated
// before index.ts's setGlobalOptions runs, and calling setGlobalOptions twice is undefined
// behavior. The web client calls these in europe-west1 (see web/src/firebase-setup.ts).
const REGION = 'europe-west1';

/**
 * Parses cookies from the Cookie header.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

/**
 * Verifies the session cookie from the request and returns the decoded token.
 * Returns null if the cookie is missing or invalid/revoked.
 */
export async function verifyRequestSession(req: Request) {
  const cookies = parseCookies(req.headers?.cookie);
  const sessionCookie = cookies['__session'];
  if (!sessionCookie) return null;

  try {
    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    return decodedToken;
  } catch (error) {
    console.error('verifySessionCookie failed:', error);
    return null;
  }
}

/**
 * HTTP endpoint to sign in. Exchanges Firebase ID token for an HTTP-only session cookie.
 */
export const sessionLogin = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const idToken = req.body?.idToken;
  if (!idToken) {
    res.status(400).send('Missing ID token');
    return;
  }

  // Set session expiration to 5 days.
  const expiresIn = 1000 * 60 * 60 * 24 * 5;

  try {
    // Verify ID token first (checkRevoked = true)
    const decodedIdToken = await getAuth().verifyIdToken(idToken, true);

    // Enforce that authentication happened within the last 5 minutes.
    const authTime = decodedIdToken.auth_time;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds - authTime > 5 * 60) {
      res.status(401).send('Recent sign-in required');
      return;
    }

    // Verify that the user still has an active Firestore account document under their UID
    const db = getFirestore();
    const accountDoc = await db.collection('accounts').doc(decodedIdToken.uid).get();
    if (!accountDoc.exists) {
      // Clean up the created Auth user if it doesn't have a Firestore account document
      try {
        await getAuth().deleteUser(decodedIdToken.uid);
      } catch (err) {
        console.warn('Failed to delete dangling Auth user:', err);
      }
      res.status(401).send('Unauthorized: No associated account.');
      return;
    }

    const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn });
    const maxAgeSeconds = expiresIn / 1000;

    // Use __session for Firebase Hosting compatibility
    res.setHeader(
      'Set-Cookie',
      `__session=${sessionCookie}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Strict`
    );
    res.status(200).json({ status: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Session creation failed:', message);
    res.status(401).send('Unauthorized');
  }
});

/**
 * HTTP endpoint to sign out. Clears the session cookie and revokes the user's session tokens.
 */
export const sessionLogout = onRequest({ region: REGION }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const cookies = parseCookies(req.headers?.cookie);
  const sessionCookie = cookies['__session'];

  if (sessionCookie) {
    try {
      const decodedToken = await getAuth().verifySessionCookie(sessionCookie);
      await getAuth().revokeRefreshTokens(decodedToken.uid);
    } catch (error) {
      // If verification fails, we still want to clear the cookie.
      console.warn('Failed to revoke session tokens on logout:', error);
    }
  }

  // Clear cookie using Max-Age=0
  res.setHeader('Set-Cookie', '__session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
  res.status(200).json({ status: 'success' });
});

export interface Mailer {
  sendSignInLink(email: string, link: string): Promise<void>;
  sendSignInCode(email: string, options: { code: string; link: string }): Promise<void>;
}

export const consoleMailer: Mailer = {
  async sendSignInLink(email: string, link: string) {
    console.log(`[MAILER] Sent sign-in link to ${email}: ${link}`);
  },
  async sendSignInCode(email: string, options: { code: string; link: string }) {
    console.log(`[MAILER] Sent OTP code ${options.code} and sign-in link to ${email}: ${options.link}`);
  },
};

export let currentMailer: Mailer = consoleMailer;

export function setMailerForTesting(newMailer: Mailer) {
  currentMailer = newMailer;
}

export async function handleFindAccountForLogin(
  usernameOrEmail: string,
  origin: string,
  deps: {
    db: FirebaseFirestore.Firestore;
    auth: {
      generateSignInWithEmailLink(
        email: string,
        settings: { url: string; handleCodeInApp: boolean }
      ): Promise<string>;
      getUser(uid: string): Promise<{ uid: string }>;
    };
    mailer: Mailer;
    pendingLoginRepo?: PendingLoginRepository;
    rng?: () => number;
    otpPepper?: string;
  }
): Promise<{ status: string }> {
  if (!usernameOrEmail || typeof usernameOrEmail !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'The function must be called with a string "usernameOrEmail".'
    );
  }

  const cleanInput = usernameOrEmail.trim();
  const lowerInput = cleanInput.toLowerCase();

  const accountsRef = deps.db.collection('accounts');

  // 1. Try username exact match
  let snapshot = await accountsRef.where('username', '==', cleanInput).get();

  // 2. Try username lowercase match
  if (snapshot.empty) {
    snapshot = await accountsRef.where('username', '==', lowerInput).get();
  }

  // 3. Try email exact match
  if (snapshot.empty) {
    snapshot = await accountsRef.where('email', '==', cleanInput).get();
  }

  // 4. Try email lowercase match
  if (snapshot.empty) {
    snapshot = await accountsRef.where('email', '==', lowerInput).get();
  }

  const doc = snapshot.docs[0];
  if (doc) {
    const data = doc.data();
    const email = data.email as string;

    let userExistsInAuth = false;
    try {
      // Check if user exists in Firebase Auth
      await deps.auth.getUser(doc.id);
      userExistsInAuth = true;
    } catch (err) {
      console.warn(
        `[Auth] User document found in Firestore (${doc.id}) but user does not exist in Firebase Auth:`,
        err
      );
    }

    if (userExistsInAuth) {
      try {
        const actionCodeSettings = {
          url: `${origin}/login`,
          handleCodeInApp: true,
        };

        const link = await deps.auth.generateSignInWithEmailLink(email, actionCodeSettings);
        
        // Generate and store OTP code (TTL 10 min, attempts 0)
        const rng = deps.rng || (() => crypto.randomBytes(4).readUInt32BE(0) / 0x100000000);
        const code = generateOtp(rng);
        
        const pepper = deps.otpPepper || process.env.OTP_PEPPER || '';
        const hashedCode = hashOtp(code, doc.id, pepper);
        
        const repo = deps.pendingLoginRepo || new PendingLoginRepository(deps.db);
        await repo.put(doc.id, {
          hash: hashedCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          attempts: 0,
        });

        await deps.mailer.sendSignInCode(email, { code, link });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Auth] Failed to generate or send sign-in link/code for ${email}: ${errMsg}`);
      }
    }
  } else {
    console.log(`[Auth] No account found for "${cleanInput}". Link not sent.`);
  }

  return { status: 'ok' };
}

/**
 * Resolves a username or email, generates a sign-in link server-side if found,
 * and sends it via the configured mailer. Returns an opaque { status: 'ok' } response.
 */
export const findAccountForLogin = onCall({ region: REGION }, async (request) => {
  const usernameOrEmail = request.data?.usernameOrEmail;
  const origin = request.rawRequest?.headers?.origin || 'http://localhost:5000';
  const db = getFirestore();

  return await handleFindAccountForLogin(usernameOrEmail, origin, {
    db,
    auth: getAuth(),
    mailer: currentMailer,
    pendingLoginRepo: new PendingLoginRepository(db),
  });
});

/**
 * Sets the role for an account in Firestore and mirrors it to custom claims in Auth.
 */
export async function setAccountRole(
  uid: string,
  role: UserRole | null,
  deps: {
    db: FirebaseFirestore.Firestore;
    auth: {
      setCustomUserClaims(uid: string, customUserClaims: object | null): Promise<void>;
    };
  } = {
    db: getFirestore(),
    auth: getAuth(),
  }
): Promise<void> {
  // Update Firestore accounts collection
  await deps.db.collection('accounts').doc(uid).update({ role });

  // Update Auth Custom Claims
  await deps.auth.setCustomUserClaims(uid, role ? { role } : null);
}

/**
 * Revokes refresh tokens and active sessions for a user account.
 */
export async function revokeAccountSessions(
  uid: string,
  deps: {
    auth: {
      revokeRefreshTokens(uid: string): Promise<void>;
    };
  } = {
    auth: getAuth(),
  }
): Promise<void> {
  await deps.auth.revokeRefreshTokens(uid);
}

export interface AuthRequest extends Request {
  auth?: {
    uid: string;
    token: DecodedIdToken;
  };
}

/**
 * A reusable higher-order guard wrapper for Cloud Functions (onRequest HTTP endpoints)
 * that verifies the session cookie and matches its role claim against the expected role.
 * If unauthorized, rejects the request with HTTP 401 or 403.
 * If the user's document no longer exists in Firestore, clears the cookie and redirects to /.
 */
export function requireRole(
  role: UserRole,
  deps: {
    verifySessionCookie: (cookie: string, checkRevoked?: boolean) => Promise<DecodedIdToken>;
    db?: FirebaseFirestore.Firestore;
  } = {
    verifySessionCookie: (cookie: string, checkRevoked?: boolean) =>
      getAuth().verifySessionCookie(cookie, checkRevoked),
    db: getFirestore(),
  }
) {
  return (handler: (req: AuthRequest, res: Response) => void | Promise<void>) => {
    return async (req: Request, res: Response): Promise<void> => {
      const cookies = parseCookies(req.headers?.cookie);
      const sessionCookie = cookies['__session'];

      if (!sessionCookie) {
        res.status(401).send('Unauthorized: Session cookie missing.');
        return;
      }

      let authReq: AuthRequest | undefined;

      try {
        const decodedToken = await deps.verifySessionCookie(sessionCookie, true);

        // Session consistency: verify that the user still has an active Firestore account document
        const db = deps.db || getFirestore();
        const accountDoc = await db.collection('accounts').doc(decodedToken.uid).get();

        if (!accountDoc.exists) {
          // Clear session cookie and redirect to front page
          res.setHeader(
            'Set-Cookie',
            '__session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict'
          );
          res.redirect(302, '/');
          return;
        }

        const claimRole = decodedToken.role as string | undefined;

        const isAllowed =
          role === 'admin' ? claimRole === 'admin' || claimRole === 'owner' : claimRole === 'owner';

        if (!isAllowed) {
          res.status(403).send('Forbidden: Insufficient permissions.');
          return;
        }

        authReq = req as AuthRequest;
        authReq.auth = {
          uid: decodedToken.uid,
          token: decodedToken,
        };
      } catch (error) {
        console.error('requireRole authentication failed:', error);
        // Clear session cookie if authentication failed
        res.setHeader(
          'Set-Cookie',
          '__session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict'
        );
        res.status(401).send('Unauthorized: Invalid or expired session.');
        return;
      }

      // Proceed to the handler (errors here won't nuke the session cookie)
      await handler(authReq, res);
    };
  };
}

export async function handleVerifyLoginOtp(
  usernameOrEmail: string,
  code: string,
  deps: {
    db: FirebaseFirestore.Firestore;
    auth: {
      createCustomToken(uid: string): Promise<string>;
    };
    pendingLoginRepo?: PendingLoginRepository;
    otpPepper?: string;
    now?: () => Date;
  }
): Promise<{ customToken: string }> {
  const uniformError = new HttpsError('failed-precondition', 'Invalid or expired code.');

  if (!usernameOrEmail || typeof usernameOrEmail !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'The function must be called with a string "usernameOrEmail".'
    );
  }
  if (!code || typeof code !== 'string') {
    throw new HttpsError(
      'invalid-argument',
      'The function must be called with a string "code".'
    );
  }

  const cleanInput = usernameOrEmail.trim();
  const lowerInput = cleanInput.toLowerCase();

  const accountsRef = deps.db.collection('accounts');

  // Lookup
  let snapshot = await accountsRef.where('username', '==', cleanInput).get();
  if (snapshot.empty) {
    snapshot = await accountsRef.where('username', '==', lowerInput).get();
  }
  if (snapshot.empty) {
    snapshot = await accountsRef.where('email', '==', cleanInput).get();
  }
  if (snapshot.empty) {
    snapshot = await accountsRef.where('email', '==', lowerInput).get();
  }

  const doc = snapshot.docs[0];
  if (!doc) {
    throw uniformError;
  }

  const repo = deps.pendingLoginRepo || new PendingLoginRepository(deps.db);
  const pendingDoc = await repo.get(doc.id);
  if (!pendingDoc) {
    throw uniformError;
  }

  const now = deps.now ? deps.now() : new Date();

  // If already expired or exceeded attempts
  if (pendingDoc.attempts >= 5 || now.getTime() >= pendingDoc.expiresAt.getTime()) {
    await repo.delete(doc.id);
    throw uniformError;
  }

  // Check format
  if (!/^\d{6}$/.test(code)) {
    const newAttempts = pendingDoc.attempts + 1;
    if (newAttempts >= 5) {
      await repo.delete(doc.id);
    } else {
      await repo.incrementAttempts(doc.id);
    }
    throw uniformError;
  }

  // Compare hash
  const pepper = deps.otpPepper || process.env.OTP_PEPPER || '';
  const expectedHash = hashOtp(code, doc.id, pepper);
  
  const { constantTimeEquals } = await import('./crypto.js');
  const isMatch = constantTimeEquals(pendingDoc.hash, expectedHash);

  if (!isMatch) {
    const newAttempts = pendingDoc.attempts + 1;
    if (newAttempts >= 5) {
      await repo.delete(doc.id);
    } else {
      await repo.incrementAttempts(doc.id);
    }
    throw uniformError;
  }

  // Success: delete pending doc and return custom token
  await repo.delete(doc.id);
  const customToken = await deps.auth.createCustomToken(doc.id);
  return { customToken };
}

export const verifyLoginOtp = onCall({ region: REGION }, async (request) => {
  const usernameOrEmail = request.data?.usernameOrEmail;
  const code = request.data?.code;
  const db = getFirestore();

  return await handleVerifyLoginOtp(usernameOrEmail, code, {
    db,
    auth: getAuth(),
    pendingLoginRepo: new PendingLoginRepository(db),
  });
});
