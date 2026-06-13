<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>Clash Tracker</h1>
    </header>
    <main class="app-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-header {
  padding: 1rem;
  background-color: var(--color-bg-panel, #242526);
  border-bottom: 1px solid var(--color-border, #3e3f40);
}
.app-content {
  flex: 1;
}
</style>
