<script setup lang="ts">
import { ref } from 'vue';

const enabled = ref(false);
function enable(): void {
  enabled.value = true;
}
</script>

<template>
  <section class="past-players" aria-label="Players who have left">
    <button v-if="!enabled" type="button" class="toggle" @click="enable">
      Show players who left
    </button>
    <!-- The lazily-loaded, infinitely-scrolling list arrives in Phase 4 Task 3. -->
    <div v-else class="past-list"></div>
  </section>
</template>

<style scoped>
.past-players {
  margin-top: var(--ct-spacing-md);
}

.toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-card);
  border: 1px dashed var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-secondary);
  font-family: var(--ct-font-display);
  font-size: 13px;
  cursor: pointer;
}
.toggle:hover {
  background-color: var(--ct-color-surface-hover);
}
</style>
