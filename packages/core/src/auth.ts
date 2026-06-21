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

