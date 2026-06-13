<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <nav class="app-nav">
    <RouterLink to="/" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">👥</span>
      <span class="nav-label">Players</span>
    </RouterLink>
    <RouterLink to="/war-plan" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">⚔️</span>
      <span class="nav-label">War Plan</span>
    </RouterLink>
    <RouterLink to="/admin" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">⚙️</span>
      <span class="nav-label">Admin</span>
    </RouterLink>
    <RouterLink to="/owner" class="nav-item" active-class="active">
      <span class="nav-icon" aria-hidden="true">👑</span>
      <span class="nav-label">Owner</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-nav {
  display: flex;
  justify-content: space-around;
  background-color: var(--color-bg-panel, #242526);
  border-top: 2px solid var(--color-border, #3e3f40);
  padding: 0.5rem 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.15);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 48px; /* Touch target >= 44px */
  text-decoration: none;
  color: var(--color-text-muted, #8e9297);
  font-size: 0.75rem;
  font-weight: 500;
  transition:
    color 0.2s ease,
    transform 0.1s ease;
}

.nav-icon {
  font-size: 1.25rem;
  margin-bottom: 0.15rem;
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-item.active {
  color: var(--color-primary, #d4af37);
  font-weight: 700;
}
</style>
