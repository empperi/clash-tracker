import { expect, test, vi } from 'vitest';
import { setupFirebase } from './firebase-setup';

test('initializes firebase with config', () => {
  const initializeApp = vi.fn().mockReturnValue('mock-app');
  const getFirestore = vi.fn().mockReturnValue('mock-db');
  const connectFirestoreEmulator = vi.fn();
  const getAuth = vi.fn().mockReturnValue('mock-auth');
  const connectAuthEmulator = vi.fn();

  const env = {
    VITE_FIREBASE_API_KEY: 'test-key',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
  };

  setupFirebase(env, {
    initializeApp,
    getFirestore,
    connectFirestoreEmulator,
    getAuth,
    connectAuthEmulator,
  });

  expect(initializeApp).toHaveBeenCalledWith({
    apiKey: 'test-key',
    authDomain: undefined,
    projectId: 'test-project',
    storageBucket: undefined,
    messagingSenderId: undefined,
    appId: undefined,
  });
  expect(getFirestore).toHaveBeenCalledWith('mock-app');
  expect(getAuth).toHaveBeenCalledWith('mock-app');
  expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  expect(connectAuthEmulator).not.toHaveBeenCalled();
});

test('connects to emulators when VITE_USE_EMULATORS is true', () => {
  const initializeApp = vi.fn().mockReturnValue('mock-app');
  const getFirestore = vi.fn().mockReturnValue('mock-db');
  const connectFirestoreEmulator = vi.fn();
  const getAuth = vi.fn().mockReturnValue('mock-auth');
  const connectAuthEmulator = vi.fn();

  const env = {
    VITE_USE_EMULATORS: 'true',
    VITE_FIREBASE_PROJECT_ID: 'test-project',
  };

  setupFirebase(env, {
    initializeApp,
    getFirestore,
    connectFirestoreEmulator,
    getAuth,
    connectAuthEmulator,
  });

  expect(connectFirestoreEmulator).toHaveBeenCalledWith('mock-db', 'localhost', 8080);
  expect(connectAuthEmulator).toHaveBeenCalledWith('mock-auth', 'http://localhost:9099');
});
