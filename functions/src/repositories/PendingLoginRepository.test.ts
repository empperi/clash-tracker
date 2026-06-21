import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PendingLoginRepository } from './PendingLoginRepository';

// Ensure the Firestore Admin SDK uses the emulator
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-pending-logins-repo' }) : getApp();
const db = getFirestore(app);

describe('PendingLoginRepository', () => {
  const collectionPath = 'pendingLogins-test';
  const repo = new PendingLoginRepository(db, collectionPath);
  const uid = 'test-user-uid';

  beforeEach(async () => {
    // Clean up document before each test
    await db.collection(collectionPath).doc(uid).delete();
  });

  afterEach(async () => {
    // Clean up after tests
    await db.collection(collectionPath).doc(uid).delete();
  });

  it('should store and retrieve pending login data', async () => {
    const expiresAt = new Date('2026-06-21T17:00:00Z');
    const data = {
      hash: 'sha256-hashed-otp-code',
      expiresAt,
      attempts: 0,
    };

    // Put data
    await repo.put(uid, data);

    // Get data
    const retrieved = await repo.get(uid);
    expect(retrieved).not.toBeNull();
    if (retrieved) {
      expect(retrieved.hash).toBe(data.hash);
      expect(retrieved.attempts).toBe(data.attempts);
      expect(retrieved.expiresAt.getTime()).toBe(expiresAt.getTime());
    }
  });

  it('should return null when getting a non-existent document', async () => {
    const retrieved = await repo.get('non-existent-uid');
    expect(retrieved).toBeNull();
  });

  it('should overwrite existing data when putting again', async () => {
    const data1 = {
      hash: 'hash-1',
      expiresAt: new Date('2026-06-21T17:00:00Z'),
      attempts: 0,
    };
    const data2 = {
      hash: 'hash-2',
      expiresAt: new Date('2026-06-21T18:00:00Z'),
      attempts: 2,
    };

    await repo.put(uid, data1);
    await repo.put(uid, data2);

    const retrieved = await repo.get(uid);
    expect(retrieved).not.toBeNull();
    if (retrieved) {
      expect(retrieved.hash).toBe(data2.hash);
      expect(retrieved.attempts).toBe(data2.attempts);
      expect(retrieved.expiresAt.getTime()).toBe(data2.expiresAt.getTime());
    }
  });

  it('should increment attempts by 1', async () => {
    const data = {
      hash: 'some-hash',
      expiresAt: new Date('2026-06-21T17:00:00Z'),
      attempts: 0,
    };

    await repo.put(uid, data);
    await repo.incrementAttempts(uid);

    let retrieved = await repo.get(uid);
    expect(retrieved?.attempts).toBe(1);

    await repo.incrementAttempts(uid);
    retrieved = await repo.get(uid);
    expect(retrieved?.attempts).toBe(2);
  });

  it('should delete the document', async () => {
    const data = {
      hash: 'some-hash',
      expiresAt: new Date('2026-06-21T17:00:00Z'),
      attempts: 0,
    };

    await repo.put(uid, data);
    let retrieved = await repo.get(uid);
    expect(retrieved).not.toBeNull();

    await repo.delete(uid);
    retrieved = await repo.get(uid);
    expect(retrieved).toBeNull();
  });
});
