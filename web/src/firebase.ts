import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { setupFirebase } from './firebase-setup';

export const { app, db, auth } = setupFirebase(
  import.meta.env as unknown as Record<string, string | undefined>,
  {
    initializeApp,
    getFirestore,
    connectFirestoreEmulator,
    getAuth,
    connectAuthEmulator,
  }
);
