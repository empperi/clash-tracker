import { describe, it, expect } from 'vitest';
import { parseEncryptionKey } from './seed-secrets';

describe('parseEncryptionKey', () => {
  it('should correctly parse 64 hex characters into a 32-byte Uint8Array', () => {
    const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const parsed = parseEncryptionKey(hexKey);
    expect(parsed.length).toBe(32);
    expect(parsed[0]).toBe(0x01);
    expect(parsed[31]).toBe(0xef);
  });

  it('should correctly decode a base64 encoded 32-byte key', () => {
    const rawKey = new Uint8Array(32).fill(0x0a);
    const base64Key = Buffer.from(rawKey).toString('base64');
    const parsed = parseEncryptionKey(base64Key);
    expect(parsed.length).toBe(32);
    expect(parsed[0]).toBe(0x0a);
    expect(parsed[31]).toBe(0x0a);
  });

  it('should fallback to UTF-8 string encoding and pad to 32 bytes', () => {
    const rawStr = 'short-key';
    const parsed = parseEncryptionKey(rawStr);
    expect(parsed.length).toBe(32);
    // 's' is 115 (0x73)
    expect(parsed[0]).toBe(115);
    // Padded bytes should be 0
    expect(parsed[31]).toBe(0);
  });

  it('should fallback to UTF-8 string encoding and truncate to 32 bytes', () => {
    const rawStr = 'a'.repeat(50);
    const parsed = parseEncryptionKey(rawStr);
    expect(parsed.length).toBe(32);
    expect(parsed[31]).toBe(97); // 'a'
  });
});
