import type { ClanRole } from '@clash-tracker/core';

/** Maps a clan role to the game's display terminology. */
export function roleLabel(role: ClanRole): string {
  switch (role) {
    case 'leader':
      return 'Leader';
    case 'coLeader':
      return 'Co-Leader';
    case 'elder':
      return 'Elder';
    case 'member':
      return 'Member';
    default: {
      const exhaustive: never = role;
      return exhaustive;
    }
  }
}
