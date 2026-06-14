export type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member';

/** A single attack a player made in a war. */
export interface AttackResult {
  readonly stars: number;
  readonly destructionPercent: number;
}

/** A single attack an opponent made against a player's base in a war. */
export interface DefenseResult {
  readonly destructionPercent: number;
}

/**
 * One player's record in a single war they were on the roster for.
 * Aggregation operates over a list of these (one per participated war).
 */
export interface PlayerWarRecord {
  /** Attacks this player made this war (empty if they missed all). */
  readonly attacks: readonly AttackResult[];
  /** Attacks this player could have made this war (2 for classic, 1 for CWL). */
  readonly attacksAvailable: number;
  /** Attacks made against this player's base this war (empty if never attacked). */
  readonly defenses: readonly DefenseResult[];
  /** ISO-8601 end time of the war; used for `lastWarParticipatedAt`. */
  readonly warEndTime: string;
}

/** Aggregate per-player stats computed over all tracked wars. */
export interface PlayerStats {
  /** Wars the player was on the roster for. */
  readonly warsParticipated: number;
  /** Total attacks made across all participated wars. */
  readonly attacksDone: number;
  /** Total attacks available across all participated wars. */
  readonly attacksAvailable: number;
  /** Rounded attack-usage % (see `attackUsagePct`). */
  readonly attackUsagePct: number;
  /** Median destruction % per attack, over all attacks done. */
  readonly medianDestruction: number;
  /** Median stars per attack, over all attacks done. */
  readonly medianStars: number;
  /** Median attacks-defended-against per war (count of defenses each war). */
  readonly medianDefenses: number;
  /** Median own-base destruction per war (worst defense each war, 0 if undefended). */
  readonly medianOwnDestruction: number;
  /** ISO-8601 end time of the most recent participated war, or null if none. */
  readonly lastWarParticipatedAt: string | null;
}

export type WarType = 'classic' | 'cwl';

export type SyncState = 'synced' | 'out-of-sync';

export interface War {
  readonly id: string;
  readonly opponentName: string;
  readonly teamSize: number;
}

/**
 * Returns rank order value for a clan role (higher is higher rank).
 */
export function clanRoleRank(role: ClanRole): number {
  switch (role) {
    case 'leader':
      return 4;
    case 'coLeader':
      return 3;
    case 'elder':
      return 2;
    case 'member':
      return 1;
    default: {
      const exhaustiveCheck: never = role;
      return exhaustiveCheck;
    }
  }
}
