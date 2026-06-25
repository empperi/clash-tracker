import { describe, it, expect } from 'vitest';
import { validateClanTag, normalizeClanTag, validatePlayerTag, normalizePlayerTag } from './tag';

describe('Clan Tag Validation and Normalization', () => {
  describe('normalizeClanTag', () => {
    it('should convert to uppercase and prepend # if missing', () => {
      expect(normalizeClanTag('2pgqypq')).toBe('#2PGQYPQ');
      expect(normalizeClanTag('#2pgqypq')).toBe('#2PGQYPQ');
    });

    it('should replace letter O with number 0', () => {
      expect(normalizeClanTag('2O8YV')).toBe('#208YV');
    });

    it('should trim whitespace', () => {
      expect(normalizeClanTag('  #2pgqypq  ')).toBe('#2PGQYPQ');
    });
  });

  describe('validateClanTag', () => {
    it('should return true for valid clan tags', () => {
      expect(validateClanTag('#2PGQYPQ')).toBe(true);
      expect(validateClanTag('#88YQ')).toBe(true);
    });

    it('should return false if missing leading #', () => {
      expect(validateClanTag('2PGQYPQ')).toBe(false);
    });

    it('should return false for invalid characters', () => {
      expect(validateClanTag('#2PGQYPQX')).toBe(false); // X is invalid
      expect(validateClanTag('#1234')).toBe(false); // 1, 3, 4 are invalid
    });

    it('should return false for empty or whitespace only tags', () => {
      expect(validateClanTag('#')).toBe(false);
      expect(validateClanTag('')).toBe(false);
    });
  });

  describe('player tag aliases', () => {
    it('should normalize and validate player tags identically', () => {
      expect(normalizePlayerTag('2pgqypq')).toBe('#2PGQYPQ');
      expect(validatePlayerTag('#2PGQYPQ')).toBe(true);
    });
  });
});
