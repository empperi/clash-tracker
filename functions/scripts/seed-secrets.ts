import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretsRepository } from '../src/repositories/SecretsRepository';
import { validateClanTag, normalizeClanTag } from '@clash-tracker/core';

/**
 * Parses and returns a 32-byte Uint8Array key from a hex, base64, or raw string.
 * Rejects any key that does not resolve to exactly 32 bytes of key material.
 */
export function parseEncryptionKey(keyStr: string): Uint8Array {
  // If it is 64 hex chars, decode as hex
  if (keyStr.length === 64 && /^[0-9a-fA-F]+$/.test(keyStr)) {
    return new Uint8Array(Buffer.from(keyStr, 'hex'));
  }

  // Base64 check: standard base64 for 32 bytes is 44 characters long
  if (keyStr.length === 44 && /^[A-Za-z0-9+/=]+$/.test(keyStr)) {
    const buf = Buffer.from(keyStr, 'base64');
    if (buf.length === 32) {
      return new Uint8Array(buf);
    }
  }

  // UTF-8 fallback
  const encoder = new TextEncoder();
  const bytes = encoder.encode(keyStr);
  if (bytes.length === 32) {
    return bytes;
  }

  throw new Error(
    `Invalid key length: Key must resolve to exactly 32 bytes (64 hex characters, a 44-character base64 string, or a 32-byte UTF-8 string). Provided key resolved to ${bytes.length} bytes.`
  );
}

async function main() {
  const clashToken = process.env.CLASH_TOKEN;
  const clanTag = process.env.CLAN_TAG;
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY;

  if (!clashToken || !clanTag || !encKeyStr) {
    console.error(
      'Error: CLASH_TOKEN, CLAN_TAG, and CLASH_TOKEN_ENC_KEY must all be set in the environment.'
    );
    process.exit(1);
  }

  // Validate clan tag
  const normalizedTag = normalizeClanTag(clanTag);
  if (!validateClanTag(normalizedTag)) {
    console.error(`Error: Invalid clan tag format: "${clanTag}"`);
    process.exit(1);
  }

  // Parse encryption key
  let encryptionKey: Uint8Array;
  try {
    encryptionKey = parseEncryptionKey(encKeyStr);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  // Initialize Firebase Admin (pointing to emulator by default if not set otherwise)
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    console.log(`Setting FIRESTORE_EMULATOR_HOST to 127.0.0.1:8080 (default emulator port)`);
  }

  console.log('Initializing Firebase Admin SDK...');
  const app =
    getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
  const db = getFirestore(app);

  const repo = new SecretsRepository(db, encryptionKey);

  console.log(`Storing normalized clan tag: ${normalizedTag}`);
  const tagResult = await repo.setClanTag(normalizedTag);
  if (!tagResult.success) {
    console.error(`Failed to store clan tag: ${tagResult.error}`);
    process.exit(1);
  }

  console.log('Encrypting and storing Clash API token...');
  const tokenResult = await repo.setToken(clashToken);
  if (!tokenResult.success) {
    console.error(`Failed to store API token: ${tokenResult.error}`);
    process.exit(1);
  }

  console.log('Successfully seeded secrets/coc!');
}

// Run main if executed directly
if (
  import.meta.url.startsWith('file:') &&
  process.argv[1] &&
  (process.argv[1].endsWith('seed-secrets.ts') || process.argv[1].endsWith('seed-secrets.js'))
) {
  main().catch((err) => {
    console.error('Unhandled execution error:', err);
    process.exit(1);
  });
}
