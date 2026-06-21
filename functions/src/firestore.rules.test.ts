import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Firestore security rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rulesPath = path.resolve(__dirname, '../../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'rules-test-project',
      firestore: {
        rules: rulesContent,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('allows public read but denies public write on players', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthenticatedDb, 'players/player123');

    // Read should succeed (even if document does not exist, getDoc doesn't fail, it returns exists = false)
    await expect(getDoc(docRef)).resolves.toBeDefined();

    // Write should fail
    await expect(setDoc(docRef, { name: 'Player' })).rejects.toThrow();
  });

  it('allows public read but denies public write on wars', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthenticatedDb, 'wars/war123');

    // Read should succeed
    await expect(getDoc(docRef)).resolves.toBeDefined();

    // Write should fail
    await expect(setDoc(docRef, { clanTag: '#TAG' })).rejects.toThrow();

    // Test subcollections under wars
    const subDocRef = doc(unauthenticatedDb, 'wars/war123/attacks/attack123');
    await expect(getDoc(subDocRef)).resolves.toBeDefined();
    await expect(setDoc(subDocRef, { attacker: 'Player' })).rejects.toThrow();
  });

  it('allows public read but denies public write on publicSettings', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const docRef = doc(unauthenticatedDb, 'publicSettings/config');

    // Read should succeed
    await expect(getDoc(docRef)).resolves.toBeDefined();

    // Write should fail
    await expect(setDoc(docRef, { clanName: 'Militia' })).rejects.toThrow();
  });

  it('denies read and write on secrets, accounts, pendingAccounts, and pendingLogins for unauthenticated users', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

    await expect(getDoc(doc(unauthenticatedDb, 'secrets/key'))).rejects.toThrow();
    await expect(setDoc(doc(unauthenticatedDb, 'secrets/key'), { val: '123' })).rejects.toThrow();

    await expect(getDoc(doc(unauthenticatedDb, 'accounts/uid'))).rejects.toThrow();
    await expect(
      setDoc(doc(unauthenticatedDb, 'accounts/uid'), { role: 'admin' })
    ).rejects.toThrow();

    await expect(getDoc(doc(unauthenticatedDb, 'pendingAccounts/email'))).rejects.toThrow();
    await expect(
      setDoc(doc(unauthenticatedDb, 'pendingAccounts/email'), { email: 'x@x.com' })
    ).rejects.toThrow();

    await expect(getDoc(doc(unauthenticatedDb, 'pendingLogins/uid'))).rejects.toThrow();
    await expect(
      setDoc(doc(unauthenticatedDb, 'pendingLogins/uid'), { hash: 'hash' })
    ).rejects.toThrow();
  });

  it('denies read and write on secrets, accounts, pendingAccounts, and pendingLogins for authenticated users (even with admin claim)', async () => {
    const authenticatedDb = testEnv
      .authenticatedContext('some-user-uid', { role: 'admin' })
      .firestore();

    await expect(getDoc(doc(authenticatedDb, 'secrets/key'))).rejects.toThrow();
    await expect(setDoc(doc(authenticatedDb, 'secrets/key'), { val: '123' })).rejects.toThrow();

    await expect(getDoc(doc(authenticatedDb, 'accounts/uid'))).rejects.toThrow();
    await expect(setDoc(doc(authenticatedDb, 'accounts/uid'), { role: 'admin' })).rejects.toThrow();

    await expect(getDoc(doc(authenticatedDb, 'pendingAccounts/email'))).rejects.toThrow();
    await expect(
      setDoc(doc(authenticatedDb, 'pendingAccounts/email'), { email: 'x@x.com' })
    ).rejects.toThrow();

    await expect(getDoc(doc(authenticatedDb, 'pendingLogins/uid'))).rejects.toThrow();
    await expect(
      setDoc(doc(authenticatedDb, 'pendingLogins/uid'), { hash: 'hash' })
    ).rejects.toThrow();
  });

  it('denies read and write on arbitrary collections (default deny catch-all)', async () => {
    const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
    const authenticatedDb = testEnv.authenticatedContext('user123').firestore();

    const randomDocUnauth = doc(unauthenticatedDb, 'randomCollection/randomDoc');
    const randomDocAuth = doc(authenticatedDb, 'randomCollection/randomDoc');

    await expect(getDoc(randomDocUnauth)).rejects.toThrow();
    await expect(setDoc(randomDocUnauth, { data: 'test' })).rejects.toThrow();

    await expect(getDoc(randomDocAuth)).rejects.toThrow();
    await expect(setDoc(randomDocAuth, { data: 'test' })).rejects.toThrow();
  });
});
