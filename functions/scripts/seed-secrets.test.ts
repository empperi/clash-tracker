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

  it('should correctly accept a raw 32-character ASCII string (32 bytes)', () => {
    const rawStr = 'a'.repeat(32);
    const parsed = parseEncryptionKey(rawStr);
    expect(parsed.length).toBe(32);
    expect(parsed[0]).toBe(97);
    expect(parsed[31]).toBe(97);
  });

  it('should throw an error for short hex keys', () => {
    const shortHex = '0123456789abcdef';
    expect(() => parseEncryptionKey(shortHex)).toThrow('Invalid key length');
  });

  it('should throw an error for long hex keys that are not 64 chars', () => {
    const oddHex = 'a'.repeat(63);
    expect(() => parseEncryptionKey(oddHex)).toThrow('Invalid key length');
  });

  it('should throw an error for short strings', () => {
    const rawStr = 'short-key';
    expect(() => parseEncryptionKey(rawStr)).toThrow('Invalid key length');
  });

  it('should throw an error for long strings', () => {
    const rawStr = 'a'.repeat(50);
    expect(() => parseEncryptionKey(rawStr)).toThrow('Invalid key length');
  });
});
