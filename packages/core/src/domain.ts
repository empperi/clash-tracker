export type ClanRole = 'leader' | 'coLeader' | 'elder' | 'member';

export interface PlayerStats {
  readonly warsParticipated: number;
  readonly attacksDone: number;
  readonly attackUsagePct: number;
  readonly medianDestruction: number;
  readonly medianStars: number;
  readonly medianDefenses?: number;
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
    default:
      const exhaustiveCheck: never = role;
      return exhaustiveCheck;
  }
}
