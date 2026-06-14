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

test('uses safe demo placeholders when running against emulators with no config', () => {
  const initializeApp = vi.fn().mockReturnValue('mock-app');
  const getFirestore = vi.fn().mockReturnValue('mock-db');
  const connectFirestoreEmulator = vi.fn();
  const getAuth = vi.fn().mockReturnValue('mock-auth');
  const connectAuthEmulator = vi.fn();

  setupFirebase(
    { VITE_USE_EMULATORS: 'true' },
    { initializeApp, getFirestore, connectFirestoreEmulator, getAuth, connectAuthEmulator }
  );

  // A non-empty apiKey avoids auth/invalid-api-key; demo values never reach Google.
  expect(initializeApp).toHaveBeenCalledWith(
    expect.objectContaining({ apiKey: 'demo-api-key', projectId: 'demo-clash-tracker' })
  );
  expect(connectAuthEmulator).toHaveBeenCalledWith('mock-auth', 'http://localhost:9099');
});

test('defaults to emulators in development mode', () => {
  const connectFirestoreEmulator = vi.fn();
  const connectAuthEmulator = vi.fn();

  setupFirebase(
    { MODE: 'development' },
    {
      initializeApp: vi.fn().mockReturnValue('mock-app'),
      getFirestore: vi.fn().mockReturnValue('mock-db'),
      connectFirestoreEmulator,
      getAuth: vi.fn().mockReturnValue('mock-auth'),
      connectAuthEmulator,
    }
  );

  expect(connectFirestoreEmulator).toHaveBeenCalled();
  expect(connectAuthEmulator).toHaveBeenCalled();
});

test('does not use emulators or demo keys in production mode', () => {
  const initializeApp = vi.fn().mockReturnValue('mock-app');
  const connectFirestoreEmulator = vi.fn();
  const connectAuthEmulator = vi.fn();

  setupFirebase(
    {
      MODE: 'production',
      VITE_FIREBASE_API_KEY: 'real-key',
      VITE_FIREBASE_PROJECT_ID: 'real-proj',
    },
    {
      initializeApp,
      getFirestore: vi.fn().mockReturnValue('mock-db'),
      connectFirestoreEmulator,
      getAuth: vi.fn().mockReturnValue('mock-auth'),
      connectAuthEmulator,
    }
  );

  expect(initializeApp).toHaveBeenCalledWith(
    expect.objectContaining({ apiKey: 'real-key', projectId: 'real-proj' })
  );
  expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  expect(connectAuthEmulator).not.toHaveBeenCalled();
});
