<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import AppNav from './components/AppNav.vue';
</script>

<template>
  <div class="app-container">
    <AppHeader />
    <main class="app-content">
      <RouterView />
    </main>
    <AppNav />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-content {
  flex: 1;
}
</style>
