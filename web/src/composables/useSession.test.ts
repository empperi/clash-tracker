import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Mock fetch
const fetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ status: 'success' }),
});
vi.stubGlobal('fetch', fetchMock);

// Mock firebase/auth
vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(),
    onAuthStateChanged: vi.fn((auth: unknown, cb: (user: unknown) => void) => {
      // We attach the callback to the mock function so tests can retrieve it
      (onAuthStateChanged as unknown as { _callback: (user: unknown) => void })._callback = cb;
      // invoke immediately with null for initial load
      cb(null);
      return vi.fn();
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock '../firebase' to avoid initializing firebase app
vi.mock('../firebase', () => {
  return {
    auth: { mockAuth: true },
  };
});

import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with null user/role and false capabilities', () => {
    const { user, role, capabilities } = useSession();
    expect(user.value).toBeNull();
    expect(role.value).toBeNull();
    expect(capabilities.value.canViewPastPlayers).toBe(false);
  });

  it('updates state when auth state triggers with admin user', async () => {
    const { user, role, capabilities } = useSession();

    // Simulate auth state change
    const mockUser = {
      uid: 'admin-123',
      email: 'admin@example.com',
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: { role: 'admin' },
      }),
    };

    const callback = (onAuthStateChanged as unknown as { _callback?: (user: unknown) => void })._callback;
    if (callback) {
      await callback(mockUser);
    }

    expect(user.value).toStrictEqual(mockUser);
    expect(role.value).toBe('admin');
    expect(capabilities.value.canViewPastPlayers).toBe(true);
    expect(capabilities.value.isOwner).toBe(false);
  });

  it('logout calls sessionLogout endpoint and signOut client SDK', async () => {
    const { logout } = useSession();
    await logout();

    expect(fetchMock).toHaveBeenCalledWith('/api/sessionLogout', { method: 'POST' });
    expect(signOut).toHaveBeenCalled();
  });
});
