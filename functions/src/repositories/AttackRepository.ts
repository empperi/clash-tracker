import { Firestore } from 'firebase-admin/firestore';
import { MappedAttack, getAttackId } from '@clash-tracker/core';

export class AttackRepository {
  constructor(private readonly db: Firestore) {}

  /**
   * Adds attacks to the war's attacks sub-collection.
   * Keyed by attackId (attackerTag-defenderTag-order).
   * Since it uses merge: true and deterministic ID, it is idempotent.
   */
  async addAttacks(warId: string, attacks: readonly MappedAttack[]): Promise<void> {
    if (attacks.length === 0) return;

    const batch = this.db.batch();
    for (const attack of attacks) {
      const attackId = getAttackId(attack.attackerTag, attack.defenderTag, attack.order);
      const docRef = this.db.doc(`wars/${warId}/attacks/${attackId}`);
      batch.set(
        docRef,
        {
          attackerTag: attack.attackerTag,
          defenderTag: attack.defenderTag,
          stars: attack.stars,
          destructionPercent: attack.destructionPercent,
          order: attack.order,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  /**
   * Lists all attacks in a given war.
   */
  async listAttacks(warId: string): Promise<MappedAttack[]> {
    const snap = await this.db.collection(`wars/${warId}/attacks`).get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        attackerTag: String(data.attackerTag || ''),
        defenderTag: String(data.defenderTag || ''),
        stars: Number(data.stars || 0),
        destructionPercent: Number(data.destructionPercent || 0),
        order: Number(data.order || 0),
      };
    });
  }
}
