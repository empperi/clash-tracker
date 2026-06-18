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
</style>
