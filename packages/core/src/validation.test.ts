import { describe, it, expect } from 'vitest';
import {
  validateAcceptancePercent,
  validateMinWarParticipation,
  validateEmail,
} from './validation.js';

describe('validation', () => {
  describe('validateAcceptancePercent', () => {
    it('accepts integers between 0 and 100', () => {
      expect(validateAcceptancePercent(0)).toEqual({ success: true, value: 0 });
      expect(validateAcceptancePercent(50)).toEqual({ success: true, value: 50 });
      expect(validateAcceptancePercent(100)).toEqual({ success: true, value: 100 });
    });

    it('rejects out of range numbers', () => {
      expect(validateAcceptancePercent(-1).success).toBe(false);
      expect(validateAcceptancePercent(101).success).toBe(false);
    });

    it('rejects non-integers', () => {
      expect(validateAcceptancePercent(50.5).success).toBe(false);
    });

    it('rejects non-numbers', () => {
      expect(validateAcceptancePercent('50').success).toBe(false);
      expect(validateAcceptancePercent(null).success).toBe(false);
      expect(validateAcceptancePercent(undefined).success).toBe(false);
    });
  });

  describe('validateMinWarParticipation', () => {
    it('accepts integers between 0 and 20', () => {
      expect(validateMinWarParticipation(0)).toEqual({ success: true, value: 0 });
      expect(validateMinWarParticipation(10)).toEqual({ success: true, value: 10 });
      expect(validateMinWarParticipation(20)).toEqual({ success: true, value: 20 });
    });

    it('rejects out of range numbers', () => {
      expect(validateMinWarParticipation(-1).success).toBe(false);
      expect(validateMinWarParticipation(21).success).toBe(false);
    });

    it('rejects non-integers', () => {
      expect(validateMinWarParticipation(5.5).success).toBe(false);
    });

    it('rejects non-numbers', () => {
      expect(validateMinWarParticipation('10').success).toBe(false);
      expect(validateMinWarParticipation(null).success).toBe(false);
      expect(validateMinWarParticipation(undefined).success).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('accepts valid email addresses and normalizes them', () => {
      expect(validateEmail('test@example.com')).toEqual({
        success: true,
        value: 'test@example.com',
      });
      expect(validateEmail('TEST.NAME@SOME-DOMAIN.CO.UK')).toEqual({
        success: true,
        value: 'test.name@some-domain.co.uk',
      });
      expect(validateEmail('  spaced@email.com  ')).toEqual({
        success: true,
        value: 'spaced@email.com',
      });
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('invalid-email').success).toBe(false);
      expect(validateEmail('invalid@').success).toBe(false);
      expect(validateEmail('@domain.com').success).toBe(false);
      expect(validateEmail('test@domain').success).toBe(false);
      expect(validateEmail('test@domain.').success).toBe(false);
      expect(validateEmail('test.domain.com').success).toBe(false);
    });

    it('rejects non-strings', () => {
      expect(validateEmail(null).success).toBe(false);
      expect(validateEmail(undefined).success).toBe(false);
      expect(validateEmail(123).success).toBe(false);
    });
  });
});
