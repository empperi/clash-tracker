import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from './crypto';

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
});
