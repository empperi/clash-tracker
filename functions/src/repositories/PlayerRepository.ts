import { Firestore, DocumentData } from 'firebase-admin/firestore';
import { Result, ok, err, Player, PlayerStats } from '@clash-tracker/core';

/**
 * Persists per-player aggregates under `players/{playerTag}` (public read,
 * Admin-SDK write only). Stats are stored flat so `lastWarParticipatedAt` can be
 * ordered/indexed at the top level (see firestore.indexes.json).
 */
export class PlayerRepository {
  constructor(private readonly db: Firestore) {}

  private toDoc(player: Player): DocumentData {
    return {
      tag: player.tag,
      name: player.name,
      role: player.role,
      thLevel: player.thLevel,
      inClan: player.inClan,
      warsParticipated: player.stats.warsParticipated,
      attacksDone: player.stats.attacksDone,
      attacksAvailable: player.stats.attacksAvailable,
      attackUsagePct: player.stats.attackUsagePct,
      medianDestruction: player.stats.medianDestruction,
      medianStars: player.stats.medianStars,
      medianDefenses: player.stats.medianDefenses,
      medianOwnDestruction: player.stats.medianOwnDestruction,
      lastWarParticipatedAt: player.stats.lastWarParticipatedAt,
    };
  }

  private fromDoc(data: DocumentData): Player {
    const stats: PlayerStats = {
      warsParticipated: Number(data.warsParticipated || 0),
      attacksDone: Number(data.attacksDone || 0),
      attacksAvailable: Number(data.attacksAvailable || 0),
      attackUsagePct: Number(data.attackUsagePct || 0),
      medianDestruction: Number(data.medianDestruction || 0),
      medianStars: Number(data.medianStars || 0),
      medianDefenses: Number(data.medianDefenses || 0),
      medianOwnDestruction: Number(data.medianOwnDestruction || 0),
      lastWarParticipatedAt: data.lastWarParticipatedAt ?? null,
    };
    return {
      tag: String(data.tag || ''),
      name: String(data.name || ''),
      role: data.role,
      thLevel: Number(data.thLevel || 0),
      inClan: data.inClan === true,
      stats,
    };
  }

  /** Creates or replaces a player document keyed by tag (idempotent). */
  async upsertPlayer(player: Player): Promise<Result<void, string>> {
    try {
      await this.db.doc(`players/${player.tag}`).set(this.toDoc(player), { merge: true });
      return ok(undefined);
    } catch (error: unknown) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }

  /** Returns all current members (inClan = true). */
  async getCurrentPlayers(): Promise<Result<readonly Player[], string>> {
    try {
      const snap = await this.db.collection('players').where('inClan', '==', true).get();
      return ok(snap.docs.map((d) => this.fromDoc(d.data())));
    } catch (error: unknown) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Returns past members (inClan = false) ordered by most-recent war
   * participation, with optional pagination for infinite scroll. `startAfter`
   * is the `lastWarParticipatedAt` value of the last row already shown.
   */
  async getPastPlayers(options?: {
    limit?: number;
    startAfter?: string;
  }): Promise<Result<readonly Player[], string>> {
    try {
      let query = this.db
        .collection('players')
        .where('inClan', '==', false)
        .orderBy('lastWarParticipatedAt', 'desc');
      if (options?.startAfter !== undefined) {
        query = query.startAfter(options.startAfter);
      }
      if (options?.limit !== undefined) {
        query = query.limit(options.limit);
      }
      const snap = await query.get();
      return ok(snap.docs.map((d) => this.fromDoc(d.data())));
    } catch (error: unknown) {
      return err(error instanceof Error ? error.message : String(error));
    }
  }
}
