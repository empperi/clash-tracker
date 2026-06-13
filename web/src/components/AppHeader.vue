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
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-panel, #242526);
  border-bottom: 2px solid var(--color-primary, #d4af37);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.clan-logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid var(--color-primary, #d4af37);
  background-color: #1a1a1a;
}

.clan-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-text-header, #ffffff);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
