import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, getKeyHash } from './crypto';

describe('crypto codec', () => {
  const dummyKey = new Uint8Array(32).fill(0x01);
  const testPlaintext = 'my-super-secret-token';
  const dummyIv = new Uint8Array(12).fill(0x02);

  it('should encrypt and decrypt correctly', () => {
    const encryptedResult = encryptToken(testPlaintext, dummyKey, dummyIv);
    expect(encryptedResult.success).toBe(true);
    if (!encryptedResult.success) return;

    const decryptedResult = decryptToken(encryptedResult.value, dummyKey);
    expect(decryptedResult.success).toBe(true);
    if (!decryptedResult.success) return;
    expect(decryptedResult.value).toBe(testPlaintext);
  });

  it('should fail if wrong key is used', () => {
    const encryptedResult = encryptToken(testPlaintext, dummyKey, dummyIv);
    expect(encryptedResult.success).toBe(true);
    if (!encryptedResult.success) return;

    const wrongKey = new Uint8Array(32).fill(0x09);
    const decryptedResult = decryptToken(encryptedResult.value, wrongKey);
    expect(decryptedResult.success).toBe(false);
  });

  it('should fail if payload is tampered', () => {
    const encryptedResult = encryptToken(testPlaintext, dummyKey, dummyIv);
    expect(encryptedResult.success).toBe(true);
    if (!encryptedResult.success) return;

    const originalBase64 = encryptedResult.value;
    // Mutate the ciphertext slightly
    const buffer = Buffer.from(originalBase64, 'base64');
    buffer[buffer.length - 1] ^= 0xff; // flip last byte
    const tamperedBase64 = buffer.toString('base64');

    const decryptedResult = decryptToken(tamperedBase64, dummyKey);
    expect(decryptedResult.success).toBe(false);
  });

  it('should fail if key is invalid length', () => {
    const shortKey = new Uint8Array(16).fill(0x01);
    const encryptedResult = encryptToken(testPlaintext, shortKey, dummyIv);
    expect(encryptedResult.success).toBe(false);
  });

  it('should compute the correct SHA-256 hash of key bytes', () => {
    const key = new Uint8Array(32).fill(0x01);
    const hash = getKeyHash(key);
    // SHA-256 of 32 bytes of 0x01 is 72cd6e8422c407fb6d098690f1130b7ded7ec2f7f5e1d30bd9d521f015363793
    expect(hash).toBe('72cd6e8422c407fb6d098690f1130b7ded7ec2f7f5e1d30bd9d521f015363793');
  });
});
