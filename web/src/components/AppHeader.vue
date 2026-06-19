<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '../composables/useSession';

interface Props {
  clanName?: string;
  clanLogo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  clanName: 'Clash Tracker',
  clanLogo: '',
});

const router = useRouter();
const { user, loading, logout } = useSession();

const username = computed(() => user.value?.displayName || user.value?.email || '');

async function handleLogout() {
  await logout();
  void router.push('/');
}

// Default to the app's PWA icon (served from /public). The `clanLogo` prop can still
// override it, leaving the hook in place for any future owner/multi-clan branding.
const defaultLogo = '/icons/icon-512x512.png';

const logoSrc = computed(() => props.clanLogo || defaultLogo);
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <img :src="logoSrc" class="clan-logo" alt="Clan Logo" />
      <h1 class="clan-name">{{ clanName }}</h1>
    </div>

    <div class="header-auth">
      <div v-if="loading" class="auth-loading">
        <span class="spinner-mini"></span>
      </div>
      <div v-else-if="user" class="user-info">
        <span class="username" :title="username">{{ username }}</span>
        <button class="logout-btn" @click="handleLogout">Logout</button>
      </div>
      <router-link v-else to="/login" class="login-link">
        Login
      </router-link>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background: var(--ct-gradient-wood);
  border-bottom: 3px solid var(--ct-color-gold);
  box-shadow:
    var(--ct-shadow-md),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  position: relative;
}

/* Shiny gold line accent below the header */
.app-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 3px;
  background: var(--ct-gradient-gold);
  z-index: 10;
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-md);
}

.clan-logo {
  /* Expanded to fill the footprint the old 2px border + backing chip used to occupy. */
  width: 42px;
  height: 42px;
  object-fit: contain;
  border-radius: var(--ct-radius-sm);
  transition: transform 0.2s ease;
}

.clan-logo:hover {
  transform: scale(1.05);
}

.clan-name {
  margin: 0;
  font-family: var(--ct-font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--ct-color-gold-text);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}

.header-auth {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-md);
}

.auth-loading {
  display: flex;
  align-items: center;
}

.spinner-mini {
  width: 16px;
  height: 16px;
  border: 2px solid var(--ct-color-border);
  border-top-color: var(--ct-color-gold);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-sm);
}

.username {
  font-family: var(--ct-font-body);
  font-size: 14px;
  color: var(--ct-color-text-secondary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  background: transparent;
  border: 1px solid var(--ct-color-border);
  border-radius: var(--ct-radius-sm);
  color: var(--ct-color-text-secondary);
  cursor: pointer;
  font-family: var(--ct-font-display);
  font-size: 11px;
  font-weight: 700;
  padding: 6px 12px;
  text-transform: uppercase;
  transition: all 0.15s ease;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.logout-btn:hover {
  background-color: var(--ct-color-red-light);
  border-color: var(--ct-color-red);
  color: var(--ct-color-red);
}

.login-link {
  color: var(--ct-color-gold);
  text-decoration: none;
  font-family: var(--ct-font-display);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 16px;
  border: 1.5px solid var(--ct-color-gold);
  border-radius: var(--ct-radius-sm);
  transition: all 0.15s ease;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.login-link:hover {
  background-color: var(--ct-color-gold-light);
  color: var(--ct-color-gold-hover);
  border-color: var(--ct-color-gold-hover);
}
</style>
