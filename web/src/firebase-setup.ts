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
    connectAuthEmulator: (auth: Auth, url: string) => void;
  }
) {
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID || 'clash-tracker-default',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const app = deps.initializeApp(firebaseConfig);
  const db = deps.getFirestore(app);
  const auth = deps.getAuth(app);

  if (env.VITE_USE_EMULATORS === 'true') {
    deps.connectFirestoreEmulator(db, 'localhost', 8080);
    deps.connectAuthEmulator(auth, 'http://localhost:9099');
  }

  return { app, db, auth };
}
