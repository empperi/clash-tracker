import { ClanRole } from './domain';

export interface MappedMember {
  readonly tag: string;
  readonly name: string;
  readonly role: ClanRole;
  readonly thLevel: number;
}

export interface MappedAttack {
  readonly attackerTag: string;
  readonly defenderTag: string;
  readonly stars: number;
  readonly destructionPercent: number;
  readonly order: number;
}

export interface MappedWarMember {
  readonly tag: string;
  readonly name: string;
  readonly townHallLevel: number;
  readonly mapPosition: number;
  readonly attacks: readonly MappedAttack[];
  readonly defenses: readonly MappedAttack[];
}

export interface MappedWar {
  readonly state: 'notInWar' | 'preparation' | 'inWar' | 'warEnded';
  readonly teamSize: number;
  readonly opponentName: string;
  readonly opponentTag: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly preparationStartTime: string;
  readonly clanMembers: readonly MappedWarMember[];
  readonly opponentMembers: readonly MappedWarMember[];
}

/**
 * Converts a CoC API timestamp (yyyyMMddTHHmmss.fffZ) to standard ISO-8601 (yyyy-MM-ddTHH:mm:ss.fffZ).
 */
export function cocTimestampToIso(timestamp: string): string {
  if (!timestamp || timestamp.length < 15) {
    return timestamp;
  }
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  const hour = timestamp.substring(9, 11);
  const minute = timestamp.substring(11, 13);
  const second = timestamp.substring(13, 15);
  const rest = timestamp.substring(15);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${rest}`;
}

function mapCocRole(role: string): ClanRole {
  switch (role) {
    case 'leader':
      return 'leader';
    case 'coLeader':
      return 'coLeader';
    case 'admin':
      return 'elder';
    default:
      return 'member';
  }
}

export function mapClan(json: unknown): readonly MappedMember[] {
  const data = json as Record<string, unknown> | null | undefined;
  if (!data || !Array.isArray(data.memberList)) {
    return [];
  }
  return data.memberList.map((m: unknown) => {
    const member = m as Record<string, unknown>;
    return {
      tag: String(member.tag || ''),
      name: String(member.name || ''),
      role: mapCocRole(String(member.role || '')),
      thLevel: Number(member.townHallLevel || 0),
    };
  });
}

export function mapWar(json: unknown): MappedWar {
  const data = json as Record<string, unknown> | null | undefined;
  if (!data || data.state === 'notInWar') {
    return {
      state: 'notInWar',
      teamSize: 0,
      opponentName: '',
      opponentTag: '',
      startTime: '',
      endTime: '',
      preparationStartTime: '',
      clanMembers: [],
      opponentMembers: [],
    };
  }

  const state = (data.state as 'notInWar' | 'preparation' | 'inWar' | 'warEnded') || 'notInWar';
  const teamSize = Number(data.teamSize || 0);

  const opponent = data.opponent as Record<string, unknown> | undefined;
  const opponentName = String(opponent?.name || '');
  const opponentTag = String(opponent?.tag || '');

  const startTime = cocTimestampToIso(String(data.startTime || ''));
  const endTime = cocTimestampToIso(String(data.endTime || ''));
  const preparationStartTime = cocTimestampToIso(String(data.preparationStartTime || ''));

  // Extract all attacks in the war to derive defenses
  const allAttacks: MappedAttack[] = [];
  const extractAttacks = (membersList: unknown) => {
    const members = (membersList || []) as Record<string, unknown>[];
    for (const m of members) {
      if (Array.isArray(m.attacks)) {
        for (const attVal of m.attacks) {
          const att = attVal as Record<string, unknown>;
          allAttacks.push({
            attackerTag: String(att.attackerTag || ''),
            defenderTag: String(att.defenderTag || ''),
            stars: Number(att.stars ?? 0),
            destructionPercent: Number(att.destructionPercentage ?? 0),
            order: Number(att.order ?? 0),
          });
        }
      }
    }
  };

  const clan = data.clan as Record<string, unknown> | undefined;
  const opponentClan = data.opponent as Record<string, unknown> | undefined;

  extractAttacks(clan?.members);
  extractAttacks(opponentClan?.members);

  const mapMembers = (membersList: unknown): MappedWarMember[] => {
    const members = (membersList || []) as Record<string, unknown>[];
    return members.map((m) => {
      const tag = String(m.tag || '');
      const memberAttacks = allAttacks.filter((att) => att.attackerTag === tag);
      const memberDefenses = allAttacks.filter((att) => att.defenderTag === tag);

      return {
        tag,
        name: String(m.name || ''),
        townHallLevel: Number(m.townhallLevel || 0),
        mapPosition: Number(m.mapPosition || 0),
        attacks: memberAttacks,
        defenses: memberDefenses,
      };
    });
  };

  const clanMembers = mapMembers(clan?.members);
  const opponentMembers = mapMembers(opponentClan?.members);

  return {
    state,
    teamSize,
    opponentName,
    opponentTag,
    startTime,
    endTime,
    preparationStartTime,
    clanMembers,
    opponentMembers,
  };
}
