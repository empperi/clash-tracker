import { describe, it, expect } from 'vitest';
import { mapClan, mapWar, cocTimestampToIso } from './mappers';

import clanFixture from './fixtures/clan.json';
import warNotInWarFixture from './fixtures/war_notInWar.json';
import warPreparationFixture from './fixtures/war_preparation.json';
import warInWarFixture from './fixtures/war_inWar.json';
import warEndedFixture from './fixtures/war_ended.json';

describe('mappers', () => {
  describe('cocTimestampToIso', () => {
    it('should format CoC timestamp to ISO-8601', () => {
      expect(cocTimestampToIso('20260614T171551.000Z')).toBe('2026-06-14T17:15:51.000Z');
      expect(cocTimestampToIso('20260614T171551Z')).toBe('2026-06-14T17:15:51Z');
    });

    it('should return input as is if invalid', () => {
      expect(cocTimestampToIso('')).toBe('');
      expect(cocTimestampToIso('abc')).toBe('abc');
    });
  });

  describe('mapClan', () => {
    it('should map clan list correctly', () => {
      const result = mapClan(clanFixture);
      expect(result.length).toBe(4);

      expect(result[0]).toEqual({
        tag: '#2PGQYPQ1',
        name: 'LeaderPlayer',
        role: 'leader',
        thLevel: 16,
      });

      expect(result[2].role).toBe('elder'); // 'admin' -> 'elder'
    });
  });

  describe('mapWar', () => {
    it('should map notInWar state', () => {
      const result = mapWar(warNotInWarFixture);
      expect(result.state).toBe('notInWar');
      expect(result.clanMembers.length).toBe(0);
    });

    it('should map preparation state', () => {
      const result = mapWar(warPreparationFixture);
      expect(result.state).toBe('preparation');
      expect(result.teamSize).toBe(5);
      expect(result.startTime).toBe('2026-06-15T10:00:00.000Z');
      expect(result.clanMembers.length).toBe(1);
      expect(result.clanMembers[0].tag).toBe('#2PGQYPQ1');
      expect(result.clanMembers[0].attacks.length).toBe(0);
    });

    it('should map inWar state with attacks and defenses', () => {
      const result = mapWar(warInWarFixture);
      expect(result.state).toBe('inWar');
      expect(result.teamSize).toBe(2);

      // LeaderPlayer has 1 attack
      const leader = result.clanMembers.find((m) => m.tag === '#2PGQYPQ1');
      expect(leader).toBeDefined();
      expect(leader?.attacks.length).toBe(1);
      expect(leader?.attacks[0]).toEqual({
        attackerTag: '#2PGQYPQ1',
        defenderTag: '#OPPONENT_M1',
        stars: 3,
        destructionPercent: 100,
        order: 1,
      });

      // CoLeaderPlayer was defended against once
      const coleader = result.clanMembers.find((m) => m.tag === '#2PGQYPQ2');
      expect(coleader).toBeDefined();
      expect(coleader?.defenses.length).toBe(1);
      expect(coleader?.defenses[0].attackerTag).toBe('#OPPONENT_M1');
      expect(coleader?.defenses[0].stars).toBe(2);
    });

    it('should map warEnded state with attacks and defenses', () => {
      const result = mapWar(warEndedFixture);
      expect(result.state).toBe('warEnded');
      expect(result.teamSize).toBe(2);
      expect(result.clanMembers.length).toBe(2);

      const leader = result.clanMembers.find((m) => m.tag === '#2PGQYPQ1');
      expect(leader).toBeDefined();
      expect(leader?.attacks.length).toBe(1);
    });
  });
});
