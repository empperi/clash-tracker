import { describe, it, expect } from 'vitest';
import { rolesToCapabilities, isValidOtpFormat, isOtpExpired, hasExceededOtpAttempts } from './auth';

describe('rolesToCapabilities', () => {
  it('returns all false capabilities for unauthenticated / unknown roles', () => {
    const anon = rolesToCapabilities(undefined);
    expect(anon).toEqual({
      canEditThresholds: false,
      canViewPastPlayers: false,
      canManageAccounts: false,
      canInviteAdmins: false,
      canEditClanIdentity: false,
      canSetToken: false,
      isOwner: false,
    });

    const nullRole = rolesToCapabilities(null);
    expect(nullRole).toEqual({
      canEditThresholds: false,
      canViewPastPlayers: false,
      canManageAccounts: false,
      canInviteAdmins: false,
      canEditClanIdentity: false,
      canSetToken: false,
      isOwner: false,
    });
  });

  it('returns admin capabilities for admin role', () => {
    const admin = rolesToCapabilities('admin');
    expect(admin).toEqual({
      canEditThresholds: true,
      canViewPastPlayers: true,
      canManageAccounts: false,
      canInviteAdmins: true,
      canEditClanIdentity: false,
      canSetToken: false,
      isOwner: false,
    });
  });

  it('returns owner capabilities for owner role', () => {
    const owner = rolesToCapabilities('owner');
    expect(owner).toEqual({
      canEditThresholds: true,
      canViewPastPlayers: true,
      canManageAccounts: true,
      canInviteAdmins: true,
      canEditClanIdentity: true,
      canSetToken: true,
      isOwner: true,
    });
  });
});

describe('isValidOtpFormat', () => {
  it('returns true for exactly 6 digits', () => {
    expect(isValidOtpFormat('123456')).toBe(true);
    expect(isValidOtpFormat('000000')).toBe(true);
    expect(isValidOtpFormat('999999')).toBe(true);
  });

  it('returns false for length not equal to 6', () => {
    expect(isValidOtpFormat('12345')).toBe(false);
    expect(isValidOtpFormat('1234567')).toBe(false);
    expect(isValidOtpFormat('')).toBe(false);
  });

  it('returns false for non-numeric strings', () => {
    expect(isValidOtpFormat('123a56')).toBe(false);
    expect(isValidOtpFormat('abcdef')).toBe(false);
    expect(isValidOtpFormat(' 12345')).toBe(false);
    expect(isValidOtpFormat('12345 ')).toBe(false);
  });
});

describe('isOtpExpired', () => {
  it('returns false when now is before expiresAt', () => {
    const now = new Date('2026-06-21T16:00:00Z');
    const expiresAt = new Date('2026-06-21T16:10:00Z');
    expect(isOtpExpired(now, expiresAt)).toBe(false);
  });

  it('returns true when now is exactly expiresAt', () => {
    const now = new Date('2026-06-21T16:10:00Z');
    const expiresAt = new Date('2026-06-21T16:10:00Z');
    expect(isOtpExpired(now, expiresAt)).toBe(true);
  });

  it('returns true when now is after expiresAt', () => {
    const now = new Date('2026-06-21T16:11:00Z');
    const expiresAt = new Date('2026-06-21T16:10:00Z');
    expect(isOtpExpired(now, expiresAt)).toBe(true);
  });
});

describe('hasExceededOtpAttempts', () => {
  it('returns false when attempts are less than max', () => {
    expect(hasExceededOtpAttempts(0, 5)).toBe(false);
    expect(hasExceededOtpAttempts(4, 5)).toBe(false);
  });

  it('returns true when attempts are equal to max', () => {
    expect(hasExceededOtpAttempts(5, 5)).toBe(true);
  });

  it('returns true when attempts are greater than max', () => {
    expect(hasExceededOtpAttempts(6, 5)).toBe(true);
  });
});

