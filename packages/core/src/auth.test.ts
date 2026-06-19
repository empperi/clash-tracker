import { describe, it, expect } from 'vitest';
import { rolesToCapabilities } from './auth';

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
