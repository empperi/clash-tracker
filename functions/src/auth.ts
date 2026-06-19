import { onRequest, onCall, HttpsError, Request } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
export const sessionLogin = onRequest(async (req, res) => {
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
export const sessionLogout = onRequest(async (req, res) => {
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
  res.setHeader(
    'Set-Cookie',
    '__session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict'
  );
  res.status(200).json({ status: 'success' });
});

/**
 * Resolves a username or email to an account email to proceed with email link sign-in.
 * Mimics success for non-existent users by returning a mock email to prevent account enumeration.
 */
export const findAccountForLogin = onCall(async (request) => {
  const usernameOrEmail = request.data?.usernameOrEmail;
  if (!usernameOrEmail || typeof usernameOrEmail !== 'string') {
    throw new HttpsError('invalid-argument', 'The function must be called with a string "usernameOrEmail".');
  }

  const cleanInput = usernameOrEmail.trim();
  const lowerInput = cleanInput.toLowerCase();

  const db = getFirestore();
  const accountsRef = db.collection('accounts');

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

  // If found, return the real email
  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    return { email: data.email };
  }

  // If not found, return a uniform payload response mimicking a successful lookup,
  // but containing a mock email target to prevent account enumeration.
  if (cleanInput.includes('@')) {
    return { email: cleanInput };
  } else {
    return { email: `${lowerInput}@clash-tracker.invalid` };
  }
});
