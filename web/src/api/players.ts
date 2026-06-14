import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter as fbStartAfter,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import type { InjectionKey } from 'vue';
import type { Player, PlayerStats } from '@clash-tracker/core';

/** The two CWL-eligibility thresholds, stored in `publicSettings/config`. */
export interface Thresholds {
  /** Acceptance Percentage Level (0–100): attack-usage % needed to be above the line. */
  readonly acceptancePct: number;
  /** Minimum War Participation (0–20): wars needed to enter the qualified pool. */
  readonly minWarParticipation: number;
}

/** Neutral defaults used when `publicSettings/config` is missing — nobody is excluded. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  acceptancePct: 0,
  minWarParticipation: 0,
};

/**
 * Decodes a `players/{tag}` document (flat shape written by the functions
 * PlayerRepository) into the core `Player`. Pure — unit-tested.
 */
export function playerFromDoc(data: DocumentData): Player {
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
    role: data.role ?? 'member',
    thLevel: Number(data.thLevel || 0),
    inClan: data.inClan === true,
    stats,
  };
}

/** Decodes the `publicSettings/config` doc into thresholds, falling back to defaults. */
export function thresholdsFromDoc(data: DocumentData | undefined): Thresholds {
  if (!data) {
    return DEFAULT_THRESHOLDS;
  }
  return {
    acceptancePct: Number(data.acceptancePct ?? DEFAULT_THRESHOLDS.acceptancePct),
    minWarParticipation: Number(data.minWarParticipation ?? DEFAULT_THRESHOLDS.minWarParticipation),
  };
}

export interface PastPlayersPage {
  readonly limit?: number;
  readonly startAfter?: string;
}

/** The read-only data the Player List view needs. Injected so views/composables are testable. */
export interface PlayersApi {
  fetchCurrentPlayers(): Promise<readonly Player[]>;
  fetchThresholds(): Promise<Thresholds>;
  fetchPastPlayers(page?: PastPlayersPage): Promise<readonly Player[]>;
}

/** Injection key so views/composables receive the api (provided in main.ts). */
export const PLAYERS_API: InjectionKey<PlayersApi> = Symbol('PlayersApi');

/** A no-op api used as the inject fallback (renders the empty state, never crashes). */
export const EMPTY_PLAYERS_API: PlayersApi = {
  fetchCurrentPlayers: async () => [],
  fetchThresholds: async () => DEFAULT_THRESHOLDS,
  fetchPastPlayers: async () => [],
};

/** The real Firestore-backed implementation (client SDK, read-only). */
export function createPlayersApi(db: Firestore): PlayersApi {
  return {
    async fetchCurrentPlayers() {
      const snap = await getDocs(query(collection(db, 'players'), where('inClan', '==', true)));
      return snap.docs.map((d) => playerFromDoc(d.data()));
    },
    async fetchThresholds() {
      const snap = await getDoc(doc(db, 'publicSettings', 'config'));
      return thresholdsFromDoc(snap.exists() ? snap.data() : undefined);
    },
    async fetchPastPlayers(page) {
      const constraints: QueryConstraint[] = [
        where('inClan', '==', false),
        orderBy('lastWarParticipatedAt', 'desc'),
      ];
      if (page?.startAfter !== undefined) {
        constraints.push(fbStartAfter(page.startAfter));
      }
      if (page?.limit !== undefined) {
        constraints.push(fbLimit(page.limit));
      }
      const snap = await getDocs(query(collection(db, 'players'), ...constraints));
      return snap.docs.map((d) => playerFromDoc(d.data()));
    },
  };
}
