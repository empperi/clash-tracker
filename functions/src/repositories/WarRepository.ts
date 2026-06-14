import { Firestore } from 'firebase-admin/firestore';
import {
  MappedWar,
  MappedWarMember,
  MappedAttack,
  WarHeader,
  Result,
  ok,
  err,
} from '@clash-tracker/core';

export class WarRepository {
  constructor(private readonly db: Firestore) {}

  /**
   * Retrieves a fully constructed MappedWar from Firestore including its members and attacks.
   */
  async getWar(warId: string): Promise<Result<MappedWar | null, string>> {
    try {
      const docSnap = await this.db.doc(`wars/${warId}`).get();
      if (!docSnap.exists) {
        return ok(null);
      }
      const header = docSnap.data();
      if (!header) {
        return ok(null);
      }

      // Load members
      const membersSnap = await this.db.collection(`wars/${warId}/members`).get();
      const allMembersData = membersSnap.docs.map((doc) => doc.data());

      // Load attacks
      const attacksSnap = await this.db.collection(`wars/${warId}/attacks`).get();
      const allAttacks = attacksSnap.docs.map((doc) => doc.data() as MappedAttack);

      // Reconstruct members with their attacks and defenses
      const mapMember = (m: Record<string, unknown>): MappedWarMember => {
        const tag = String(m.tag || '');
        const memberAttacks = allAttacks.filter((a) => a.attackerTag === tag);
        const memberDefenses = allAttacks.filter((a) => a.defenderTag === tag);

        // Sort attacks and defenses by order
        const sortedAttacks = [...memberAttacks].sort((a, b) => a.order - b.order);
        const sortedDefenses = [...memberDefenses].sort((a, b) => a.order - b.order);

        return {
          tag,
          name: String(m.name || ''),
          townHallLevel: Number(m.townHallLevel || 0),
          mapPosition: Number(m.mapPosition || 0),
          attacks: sortedAttacks,
          defenses: sortedDefenses,
        };
      };

      const clanMembers = allMembersData
        .filter((m) => m.isOpponent !== true)
        .map(mapMember)
        .sort((a, b) => a.mapPosition - b.mapPosition);

      const opponentMembers = allMembersData
        .filter((m) => m.isOpponent === true)
        .map(mapMember)
        .sort((a, b) => a.mapPosition - b.mapPosition);

      return ok({
        state: header.state as 'preparation' | 'inWar' | 'warEnded',
        teamSize: Number(header.teamSize || 0),
        opponentName: String(header.opponentName || ''),
        opponentTag: String(header.opponentTag || ''),
        startTime: String(header.startTime || ''),
        endTime: String(header.endTime || ''),
        preparationStartTime: String(header.preparationStartTime || ''),
        clanMembers,
        opponentMembers,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`Error in getWar: ${msg}`);
      return err(msg);
    }
  }

  /**
   * Saves the war header data to Firestore (wars/{warId}).
   */
  async saveWarHeader(warId: string, header: WarHeader): Promise<void> {
    const docRef = this.db.doc(`wars/${warId}`);
    await docRef.set(
      {
        state: header.state,
        teamSize: header.teamSize,
        opponentName: header.opponentName,
        opponentTag: header.opponentTag,
        startTime: header.startTime,
        endTime: header.endTime,
        preparationStartTime: header.preparationStartTime,
      },
      { merge: true }
    );
  }

  /**
   * Upserts the list of members under wars/{warId}/members/{memberTag}.
   */
  async upsertMembers(
    warId: string,
    members: readonly MappedWarMember[],
    isOpponent: boolean
  ): Promise<void> {
    if (members.length === 0) return;

    const batch = this.db.batch();
    for (const member of members) {
      const docRef = this.db.doc(`wars/${warId}/members/${member.tag}`);
      batch.set(
        docRef,
        {
          tag: member.tag,
          name: member.name,
          townHallLevel: member.townHallLevel,
          mapPosition: member.mapPosition,
          isOpponent,
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  /**
   * Updates the sync status metadata on the war document.
   */
  async updateSyncStatus(
    warId: string,
    syncState: 'synced' | 'out-of-sync',
    lastSyncedAt: string
  ): Promise<void> {
    const docRef = this.db.doc(`wars/${warId}`);
    await docRef.set(
      {
        syncState,
        lastSyncedAt,
      },
      { merge: true }
    );
  }

  /**
   * Finds the active war in the database (i.e. not ended).
   */
  async getActiveWar(): Promise<Result<{ warId: string; war: MappedWar } | null, string>> {
    try {
      const snap = await this.db
        .collection('wars')
        .where('state', 'in', ['preparation', 'inWar'])
        .limit(1)
        .get();
      if (snap.empty) {
        return ok(null);
      }
      const doc = snap.docs[0];
      if (!doc) {
        return ok(null);
      }
      const warId = doc.id;
      const warResult = await this.getWar(warId);
      if (!warResult.success) {
        return err(warResult.error);
      }
      if (!warResult.value) {
        return ok(null);
      }
      return ok({ warId, war: warResult.value });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return err(msg);
    }
  }
}
