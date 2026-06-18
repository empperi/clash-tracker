import crypto from 'node:crypto';
import { Result, ok, err } from '@clash-tracker/core';

/**
 * Encrypts a plaintext token using AES-256-GCM.
 * @param plaintext The plaintext token to encrypt.
 * @param key A 32-byte key for encryption.
 * @param iv An optional 12-byte IV (for deterministic testing). If not provided, a random IV is generated.
 * @returns A Result wrapping the base64-encoded payload (iv + tag + ciphertext) or an error message.
 */
export function encryptToken(
  plaintext: string,
  key: Uint8Array,
  iv?: Uint8Array
): Result<string, string> {
  try {
    if (key.length !== 32) {
      return err('Encryption key must be exactly 32 bytes');
    }

    const actualIv = iv || crypto.randomBytes(12);
    if (actualIv.length !== 12) {
      return err('IV must be exactly 12 bytes');
    }

    const cipher = crypto.createCipheriv('aes-256-gcm', key, actualIv);
    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const tag = cipher.getAuthTag();

    // Package as: iv (12 bytes) + tag (16 bytes) + ciphertext
    const payload = Buffer.concat([actualIv, tag, ciphertext]);
    return ok(payload.toString('base64'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message || 'Encryption failed');
  }
}

/**
 * Decrypts a token encrypted with AES-256-GCM.
 * @param payload The base64-encoded encrypted token payload.
 * @param key A 32-byte key for decryption.
 * @returns A Result wrapping the decrypted plaintext token or an error message.
 */
export function decryptToken(payload: string, key: Uint8Array): Result<string, string> {
  try {
    if (key.length !== 32) {
      return err('Decryption key must be exactly 32 bytes');
    }

    const buffer = Buffer.from(payload, 'base64');
    // Minimum length: 12 bytes IV + 16 bytes tag = 28 bytes
    if (buffer.length < 28) {
      return err('Invalid payload length');
    }

    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return ok(decrypted.toString('utf8'));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err(message || 'Decryption failed');
  }
}

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
