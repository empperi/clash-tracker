export type UserRole = 'owner' | 'admin';

export interface UserCapabilities {
  readonly canEditThresholds: boolean;
  readonly canViewPastPlayers: boolean;
  readonly canManageAccounts: boolean;
  readonly canInviteAdmins: boolean;
  readonly canEditClanIdentity: boolean;
  readonly canSetToken: boolean;
  readonly isOwner: boolean;
}

/**
 * Maps a user's role to their granular capabilities.
 */
export function rolesToCapabilities(role: UserRole | null | undefined): UserCapabilities {
  const isAdmin = role === 'admin' || role === 'owner';
  const isOwner = role === 'owner';

  return {
    canEditThresholds: isAdmin,
    canViewPastPlayers: isAdmin,
    canManageAccounts: isOwner,
    canInviteAdmins: isAdmin,
    canEditClanIdentity: isOwner,
    canSetToken: isOwner,
    isOwner,
  };
}

export function isValidOtpFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function isOtpExpired(now: Date, expiresAt: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function hasExceededOtpAttempts(attempts: number, max: number): boolean {
  return attempts >= max;
}

export function isInvitationExpired(createdAt: Date, now: Date): boolean {
  const diffMs = now.getTime() - createdAt.getTime();
  return diffMs > 30 * 60 * 1000;
}

/**
 * Determines if a target account can be deleted by the current owner.
 * Returns false if the target is the current owner themselves (self-deletion is forbidden).
 */
export function canDeleteAccount(targetUid: string, currentOwnerUid: string): boolean {
  if (!targetUid || !currentOwnerUid) {
    return false;
  }
  return targetUid !== currentOwnerUid;
}
