<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  clickable?: boolean;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
  active: false,
});

const rowClass = computed(() => {
  return {
    'ct-row': true,
    'ct-row-clickable': props.clickable,
    'ct-row-active': props.active,
  };
});
</script>

<template>
  <div :class="rowClass" style="min-height: 44px">
    <slot />
  </div>
</template>

<style scoped>
.ct-row {
  display: flex;
  align-items: center;
  min-height: 44px; /* Touch target requirement */
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-card);
  border-bottom: 1px solid var(--ct-color-border);
  font-family: var(--ct-font-body);
  font-size: 15px;
  color: var(--ct-color-text-primary);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.ct-row:last-child {
  border-bottom: none;
}

/* Hover effects for clickable rows */
.ct-row-clickable {
  cursor: pointer;
}

.ct-row-clickable:hover {
  background-color: var(--ct-color-surface-hover);
}

/* Selected/active row style */
.ct-row-active {
  background: var(--ct-gradient-gold-soft);
  border-left: 4px solid var(--ct-color-gold);
  padding-left: calc(var(--ct-spacing-md) - 4px); /* Adjust padding to keep alignment */
}
</style>
