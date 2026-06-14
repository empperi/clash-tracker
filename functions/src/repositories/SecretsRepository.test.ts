import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretsRepository } from './SecretsRepository';

// Ensure the Firestore Admin SDK uses the emulator
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
const db = getFirestore(app);

describe('SecretsRepository', () => {
  const dummyKey = new Uint8Array(32).fill(0x05);
  const docPath = 'secrets/secrets-repo-test';
  const repo = new SecretsRepository(db, dummyKey, docPath);
  const docRef = db.doc(docPath);

  beforeEach(async () => {
    // Clean up the document before each test
    await docRef.delete();
  });

  afterEach(async () => {
    // Clean up after tests
    await docRef.delete();
  });

  it('should encrypt and store the API token, and decrypt it back', async () => {
    const rawToken = 'my-super-secret-coc-api-token';

    // Set token
    const setResult = await repo.setToken(rawToken);
    expect(setResult.success).toBe(true);

    // Verify stored data does NOT equal the plaintext token (it should be encrypted)
    const docSnap = await docRef.get();
    expect(docSnap.exists).toBe(true);
    const storedData = docSnap.data();
    expect(storedData?.encryptedToken).toBeDefined();
    expect(storedData?.encryptedToken).not.toBe(rawToken);

    // Get and decrypt token back
    const getResult = await repo.getDecryptedToken();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.value).toBe(rawToken);
    }
  });

  it('should fail to decrypt if no token is stored', async () => {
    const getResult = await repo.getDecryptedToken();
    expect(getResult.success).toBe(false);
  });

  it('should successfully store and retrieve a valid clan tag', async () => {
    const clanTag = '#2PGQYPQ';

    // Set clan tag
    const setResult = await repo.setClanTag(clanTag);
    expect(setResult.success).toBe(true);

    // Verify raw Firestore document has it
    const docSnap = await docRef.get();
    expect(docSnap.exists).toBe(true);
    const storedData = docSnap.data();
    expect(storedData?.clanTag).toBe(clanTag);

    // Get clan tag back
    const getResult = await repo.getClanTag();
    expect(getResult.success).toBe(true);
    if (getResult.success) {
      expect(getResult.value).toBe(clanTag);
    }
  });

  it('should reject storing an invalid clan tag', async () => {
    const invalidTag = 'INVALID-TAG-123';
    const setResult = await repo.setClanTag(invalidTag);
    expect(setResult.success).toBe(false);

    // Document should still be empty
    const docSnap = await docRef.get();
    expect(docSnap.exists).toBe(false);
  });
});
