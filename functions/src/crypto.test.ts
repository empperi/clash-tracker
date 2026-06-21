import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken, generateOtp, hashOtp, constantTimeEquals } from './crypto';

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

describe('generateOtp', () => {
  it('should draw 6 digits using the injected rng', () => {
    // rng returns a float in [0, 1). Let's test standard values.
    const mockRng = (val: number) => () => val;
    expect(generateOtp(mockRng(0.1234567))).toBe('123456');
    expect(generateOtp(mockRng(0.9999999))).toBe('999999');
  });

  it('should preserve leading zeros', () => {
    const mockRng = (val: number) => () => val;
    expect(generateOtp(mockRng(0.001234))).toBe('001234');
    expect(generateOtp(mockRng(0.000005))).toBe('000005');
    expect(generateOtp(mockRng(0.0))).toBe('000000');
  });

  it('should handle rng float boundary of exactly 1.0 or greater via modulo', () => {
    const mockRng = (val: number) => () => val;
    expect(generateOtp(mockRng(1.0))).toBe('000000');
    expect(generateOtp(mockRng(1.000005))).toBe('000005');
  });
});

describe('hashOtp', () => {
  const uid = 'user-123';
  const pepper = 'my-pepper-secret';

  it('should produce identical hashes for identical inputs', () => {
    const hash1 = hashOtp('123456', uid, pepper);
    const hash2 = hashOtp('123456', uid, pepper);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it('should produce different hashes for different codes, uids, or peppers', () => {
    const hash1 = hashOtp('123456', uid, pepper);
    const hashDiffCode = hashOtp('123457', uid, pepper);
    const hashDiffUid = hashOtp('123456', 'user-456', pepper);
    const hashDiffPepper = hashOtp('123456', uid, 'other-pepper');

    expect(hash1).not.toBe(hashDiffCode);
    expect(hash1).not.toBe(hashDiffUid);
    expect(hash1).not.toBe(hashDiffPepper);
  });
});

describe('constantTimeEquals', () => {
  it('should return true for identical strings', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('', '')).toBe(true);
  });

  it('should return false for different strings of same length', () => {
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
  });

  it('should return false for strings of different lengths', () => {
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
    expect(constantTimeEquals('abc', 'ab')).toBe(false);
  });
});
