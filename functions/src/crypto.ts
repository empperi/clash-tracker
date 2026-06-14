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
  } catch (error: any) {
    return err(error?.message || 'Encryption failed');
  }
}

/**
 * Decrypts a token encrypted with AES-256-GCM.
 * @param payload The base64-encoded encrypted token payload.
 * @param key A 32-byte key for decryption.
 * @returns A Result wrapping the decrypted plaintext token or an Error.
 */
export function decryptToken(
  payload: string,
  key: Uint8Array
): Result<string, Error> {
  try {
    if (key.length !== 32) {
      return err(new Error('Decryption key must be exactly 32 bytes'));
    }

    const buffer = Buffer.from(payload, 'base64');
    // Minimum length: 12 bytes IV + 16 bytes tag = 28 bytes
    if (buffer.length < 28) {
      return err(new Error('Invalid payload length'));
    }

    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return ok(decrypted.toString('utf8'));
  } catch (error: any) {
    return err(error instanceof Error ? error : new Error(error?.message || 'Decryption failed'));
  }
}
