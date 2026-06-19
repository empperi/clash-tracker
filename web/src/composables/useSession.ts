import { ref, computed } from 'vue';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { rolesToCapabilities, type UserRole, type UserCapabilities } from '@clash-tracker/core';

// Global state so that all callers share it
const currentUser = ref<User | null>(null);
const userRole = ref<UserRole | null>(null);
const loading = ref(true);

let authListenerInitialized = false;

export function useSession() {
  if (!authListenerInitialized && typeof window !== 'undefined') {
    authListenerInitialized = true;
    onAuthStateChanged(auth, async (user) => {
      currentUser.value = user;
      if (user) {
        // Refresh token to get latest claims
        try {
          const tokenResult = await user.getIdTokenResult(true);
          const claimRole = tokenResult.claims.role as UserRole | undefined;
          userRole.value = claimRole || null;
        } catch (e) {
          console.error('Failed to get user claims:', e);
          userRole.value = null;
        }
      } else {
        userRole.value = null;
      }
      loading.value = false;
    });
  }

  const role = computed(() => userRole.value);
  const capabilities = computed(() => rolesToCapabilities(userRole.value));

  async function logout() {
    loading.value = true;
    try {
      // Call sessionLogout API to clear session cookie on server and revoke refresh tokens
      await fetch('/api/sessionLogout', { method: 'POST' });
    } catch (e) {
      console.warn('Failed to call sessionLogout api:', e);
    }
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Firebase signOut failed:', e);
    } finally {
      currentUser.value = null;
      userRole.value = null;
      loading.value = false;
    }
  }

  return {
    user: currentUser,
    role,
    capabilities,
    loading,
    logout,
  };
}
