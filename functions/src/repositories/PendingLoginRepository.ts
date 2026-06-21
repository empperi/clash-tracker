import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface PendingLogin {
  readonly hash: string;
  readonly expiresAt: Date;
  readonly attempts: number;
}

export class PendingLoginRepository {
  constructor(
    private readonly db: Firestore,
    private readonly collectionPath: string = 'pendingLogins'
  ) {}

  async put(uid: string, data: PendingLogin): Promise<void> {
    await this.db
      .collection(this.collectionPath)
      .doc(uid)
      .set({
        hash: data.hash,
        expiresAt: Timestamp.fromDate(data.expiresAt),
        attempts: data.attempts,
      });
  }

  async get(uid: string): Promise<PendingLogin | null> {
    const snap = await this.db.collection(this.collectionPath).doc(uid).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data();
    if (!data) {
      return null;
    }
    return {
      hash: data.hash,
      expiresAt: (data.expiresAt as Timestamp).toDate(),
      attempts: data.attempts,
    };
  }

  async incrementAttempts(uid: string): Promise<void> {
    await this.db
      .collection(this.collectionPath)
      .doc(uid)
      .update({
        attempts: FieldValue.increment(1),
      });
  }

  async delete(uid: string): Promise<void> {
    await this.db.collection(this.collectionPath).doc(uid).delete();
  }
}
