<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  clanName?: string;
  clanLogo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  clanName: 'Clash Tracker',
  clanLogo: '',
});

// Inline SVG data URI for default logo
const defaultLogo =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%23d4af37"><circle cx="50" cy="50" r="40" stroke="%238a6d1c" stroke-width="5" /><path d="M30 45 h40 v10 h-40 z" /><path d="M45 30 h10 v40 h-10 z" /></svg>';

const logoSrc = computed(() => props.clanLogo || defaultLogo);
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <img :src="logoSrc" class="clan-logo" alt="Clan Logo" />
      <h1 class="clan-name">{{ clanName }}</h1>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-card);
  border-bottom: 2px solid var(--ct-color-gold);
  box-shadow: var(--ct-shadow-md);
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-sm);
}

.clan-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: var(--ct-radius-sm);
  border: 2px solid var(--ct-color-gold);
  background-color: var(--ct-color-surface-well);
}

.clan-name {
  margin: 0;
  font-family: var(--ct-font-display);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ct-color-gold-text);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
