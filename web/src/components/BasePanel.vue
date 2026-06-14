<script setup lang="ts">
import { useSlots } from 'vue';

interface Props {
  title?: string;
}

defineProps<Props>();
const slots = useSlots();
</script>

<template>
  <div class="ct-panel">
    <!-- Header: show if title prop exists OR if title slot is provided -->
    <div
      v-if="title || slots.title"
      class="ct-panel-header"
    >
      <h3 class="ct-panel-title">
        <slot name="title">{{ title }}</slot>
      </h3>
    </div>

    <!-- Body -->
    <div class="ct-panel-body">
      <slot />
    </div>

    <!-- Footer -->
    <div
      v-if="slots.footer"
      class="ct-panel-footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.ct-panel {
  background-color: var(--ct-color-surface-card);
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-lg);
  box-shadow: var(--ct-shadow-md);
  margin-bottom: var(--ct-spacing-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ct-panel-header {
  background-color: var(--ct-color-surface-well);
  border-bottom: 2px solid var(--ct-color-border);
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  display: flex;
  align-items: center;
}

.ct-panel-title {
  margin: 0;
  font-family: var(--ct-font-display);
  font-size: 18px;
  color: var(--ct-color-gold-text);
  line-height: 1.2;
}

.ct-panel-body {
  padding: var(--ct-spacing-md);
  flex: 1;
}

.ct-panel-footer {
  background-color: var(--ct-color-surface-well);
  border-top: 2px solid var(--ct-color-border);
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
}
</style>
