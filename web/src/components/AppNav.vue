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
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  background: linear-gradient(to top, #120a05 0%, #22140b 100%);
  border-top: 2px solid var(--ct-color-border);
  padding: 0.4rem 0;
  box-shadow:
    var(--ct-shadow-lg),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 48px; /* Touch target >= 44px */
  text-decoration: none;
  color: var(--ct-color-text-secondary);
  font-family: var(--ct-font-body);
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.nav-icon {
  font-size: 1.3rem;
  margin-bottom: 0.2rem;
  filter: grayscale(40%);
  transition:
    filter 0.2s ease,
    transform 0.2s ease;
}

.nav-item:hover:not(.active) .nav-icon {
  filter: grayscale(0%);
  transform: translateY(-2px);
}

.nav-item:active {
  transform: scale(0.92);
}

.nav-item.active {
  color: var(--ct-color-gold);
  font-weight: 700;
}

.nav-item.active .nav-icon {
  filter: grayscale(0%);
  transform: scale(1.1) translateY(-2px);
  text-shadow: 0 0 10px rgba(255, 194, 0, 0.6);
}

/* Glowing gold indicator dot for active view */
.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--ct-color-gold);
  box-shadow: 0 0 6px var(--ct-color-gold);
}
</style>
