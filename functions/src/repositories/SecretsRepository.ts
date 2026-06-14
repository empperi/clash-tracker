import { Firestore } from 'firebase-admin/firestore';
import { Result, ok, err, normalizeClanTag, validateClanTag } from '@clash-tracker/core';
import { encryptToken, decryptToken } from '../crypto';

export class SecretsRepository {
  private readonly docRef;

  constructor(
    private readonly db: Firestore,
    private readonly encryptionKey: Uint8Array
  ) {
    this.docRef = this.db.doc('secrets/coc');
  }

  /**
   * Encrypts and stores the CoC API token in secrets/coc.
   */
  async setToken(plaintextToken: string): Promise<Result<void, string>> {
    try {
      const encryptRes = encryptToken(plaintextToken, this.encryptionKey);
      if (!encryptRes.success) {
        return err(encryptRes.error);
      }
      await this.docRef.set({ encryptedToken: encryptRes.value }, { merge: true });
      return ok(undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err(message || 'Failed to save token');
    }
  }

  /**
   * Retrieves and decrypts the CoC API token from secrets/coc.
   */
  async getDecryptedToken(): Promise<Result<string, string>> {
    try {
      const docSnap = await this.docRef.get();
      if (!docSnap.exists) {
        return err('No secrets found');
      }
      const data = docSnap.data();
      const encryptedToken = data?.encryptedToken;
      if (!encryptedToken) {
        return err('No token found in secrets');
      }
      const decryptRes = decryptToken(encryptedToken, this.encryptionKey);
      if (!decryptRes.success) {
        return err(decryptRes.error);
      }
      return ok(decryptRes.value);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err(message || 'Failed to retrieve/decrypt token');
    }
  }

  /**
   * Validates and stores the clan tag in secrets/coc.
   */
  async setClanTag(clanTag: string): Promise<Result<void, string>> {
    try {
      const normalized = normalizeClanTag(clanTag);
      if (!validateClanTag(normalized)) {
        return err('Invalid clan tag');
      }
      await this.docRef.set({ clanTag: normalized }, { merge: true });
      return ok(undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err(message || 'Failed to save clan tag');
    }
  }

  /**
   * Retrieves the stored clan tag from secrets/coc.
   */
  async getClanTag(): Promise<Result<string, string>> {
    try {
      const docSnap = await this.docRef.get();
      if (!docSnap.exists) {
        return err('No secrets found');
      }
      const data = docSnap.data();
      const clanTag = data?.clanTag;
      if (!clanTag) {
        return err('No clan tag found in secrets');
      }
      return ok(clanTag);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return err(message || 'Failed to retrieve clan tag');
    }
  }
}
