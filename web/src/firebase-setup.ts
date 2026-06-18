import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';

export function setupFirebase(
  env: Record<string, string | undefined>,
  deps: {
    initializeApp: (options: FirebaseOptions) => FirebaseApp;
    getFirestore: (app: FirebaseApp) => Firestore;
    connectFirestoreEmulator: (db: Firestore, host: string, port: number) => void;
    getAuth: (app: FirebaseApp) => Auth;
    connectAuthEmulator: (auth: Auth, url: string, options?: { disableWarnings: boolean }) => void;
  }
) {
  // Use the emulators when explicitly requested, or by default in dev mode. The Firebase
  // web config (incl. apiKey) is NOT secret, but it must be a non-empty, well-formed value
  // or the Auth SDK throws `auth/invalid-api-key`. Against the emulators the values are
  // never sent to Google, so safe demo placeholders let local dev run with zero setup and
  // no chance of touching production. Production builds must supply the real VITE_FIREBASE_*
  // values at build time (they are public, so plain build-time vars are fine).
  const useEmulators =
    env.VITE_USE_EMULATORS !== undefined
      ? env.VITE_USE_EMULATORS === 'true'
      : env.MODE === 'development';

  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || (useEmulators ? 'demo-api-key' : undefined),
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID || (useEmulators ? 'demo-clash-tracker' : undefined),
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const app = deps.initializeApp(firebaseConfig);
  const db = deps.getFirestore(app);
  const auth = deps.getAuth(app);

  if (useEmulators) {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'localhost';
    deps.connectFirestoreEmulator(db, host, 8080);
    deps.connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  }

  return { app, db, auth };
}
