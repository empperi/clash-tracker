import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { PlayerRepository } from './PlayerRepository';
import type { Player, PlayerStats } from '@clash-tracker/core';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-player-repo' }) : getApp();
const db = getFirestore(app);

const stats = (over: Partial<PlayerStats> = {}): PlayerStats => ({
  warsParticipated: 5,
  attacksDone: 8,
  attacksAvailable: 10,
  attackUsagePct: 80,
  medianDestruction: 90,
  medianStars: 2,
  medianDefenses: 1,
  medianOwnDestruction: 50,
  lastWarParticipatedAt: '2026-06-10T10:00:00.000Z',
  ...over,
});

const player = (
  tag: string,
  over: Partial<Player> = {},
  statsOver: Partial<PlayerStats> = {}
): Player => ({
  tag,
  name: tag.replace('#', ''),
  role: 'member',
  thLevel: 15,
  inClan: true,
  stats: stats(statsOver),
  ...over,
});

describe('PlayerRepository', () => {
  const repo = new PlayerRepository(db);
  const playersCol = db.collection('players');

  const cleanup = async () => {
    const snap = await playersCol.get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
    }
  };

  beforeEach(cleanup);
  afterEach(cleanup);

  it('upserts a player and reads it back with the full stats shape', async () => {
    const p = player('#AAA');
    const setRes = await repo.upsertPlayer(p);
    expect(setRes.success).toBe(true);

    const current = await repo.getCurrentPlayers();
    expect(current.success).toBe(true);
    if (current.success) {
      expect(current.value).toHaveLength(1);
      expect(current.value[0]).toEqual(p);
    }
  });

  it('getCurrentPlayers returns only inClan=true players', async () => {
    await repo.upsertPlayer(player('#IN', { inClan: true }));
    await repo.upsertPlayer(player('#OUT', { inClan: false }));

    const current = await repo.getCurrentPlayers();
    expect(current.success).toBe(true);
    if (current.success) {
      expect(current.value.map((p) => p.tag)).toEqual(['#IN']);
    }
  });

  it('getPastPlayers returns only left players ordered by lastWarParticipatedAt desc', async () => {
    await repo.upsertPlayer(player('#STILL', { inClan: true }));
    await repo.upsertPlayer(
      player('#OLD', { inClan: false }, { lastWarParticipatedAt: '2026-05-01T10:00:00.000Z' })
    );
    await repo.upsertPlayer(
      player('#RECENT', { inClan: false }, { lastWarParticipatedAt: '2026-06-12T10:00:00.000Z' })
    );
    await repo.upsertPlayer(
      player('#MID', { inClan: false }, { lastWarParticipatedAt: '2026-06-01T10:00:00.000Z' })
    );

    const past = await repo.getPastPlayers();
    expect(past.success).toBe(true);
    if (past.success) {
      expect(past.value.map((p) => p.tag)).toEqual(['#RECENT', '#MID', '#OLD']);
    }
  });

  it('paginates past players with limit and startAfter', async () => {
    await repo.upsertPlayer(
      player('#P1', { inClan: false }, { lastWarParticipatedAt: '2026-06-12T10:00:00.000Z' })
    );
    await repo.upsertPlayer(
      player('#P2', { inClan: false }, { lastWarParticipatedAt: '2026-06-11T10:00:00.000Z' })
    );
    await repo.upsertPlayer(
      player('#P3', { inClan: false }, { lastWarParticipatedAt: '2026-06-10T10:00:00.000Z' })
    );

    const page1 = await repo.getPastPlayers({ limit: 2 });
    expect(page1.success).toBe(true);
    if (!page1.success) return;
    expect(page1.value.map((p) => p.tag)).toEqual(['#P1', '#P2']);

    const cursor = page1.value[page1.value.length - 1]!.stats.lastWarParticipatedAt!;
    const page2 = await repo.getPastPlayers({ limit: 2, startAfter: cursor });
    expect(page2.success).toBe(true);
    if (page2.success) {
      expect(page2.value.map((p) => p.tag)).toEqual(['#P3']);
    }
  });

  it('upsert overwrites an existing player (idempotent on tag)', async () => {
    await repo.upsertPlayer(player('#X', {}, { attackUsagePct: 50 }));
    await repo.upsertPlayer(player('#X', {}, { attackUsagePct: 95 }));

    const current = await repo.getCurrentPlayers();
    expect(current.success).toBe(true);
    if (current.success) {
      expect(current.value).toHaveLength(1);
      expect(current.value[0]!.stats.attackUsagePct).toBe(95);
    }
  });
});
