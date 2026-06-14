<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
});

const buttonClass = computed(() => {
  return {
    'ct-btn': true,
    [`ct-btn-${props.variant}`]: true,
    'ct-btn-disabled': props.disabled,
  };
});
</script>

<template>
  <button
    :class="buttonClass"
    :disabled="disabled"
    :aria-disabled="disabled"
    style="min-height: 44px;"
  >
    <slot />
  </button>
</template>

<style scoped>
.ct-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px; /* Touch target minimum requirement */
  min-width: 44px;  /* Touch target minimum requirement */
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  font-family: var(--ct-font-display);
  font-size: 16px;
  font-weight: 600;
  border-radius: var(--ct-radius-md);
  border: 2px solid var(--ct-color-border);
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  box-shadow: var(--ct-shadow-sm);
  user-select: none;
}

/* Primary style (Gold-on-wood theme) */
.ct-btn-primary {
  background-color: var(--ct-color-gold);
  color: var(--ct-color-surface-well); /* Dark contrast */
  border-color: var(--ct-color-gold);
}

.ct-btn-primary:hover:not(:disabled) {
  background-color: var(--ct-color-gold-hover);
  border-color: var(--ct-color-gold-hover);
  transform: translateY(-1px);
}

.ct-btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}

/* Secondary style (Stone/Parchment theme) */
.ct-btn-secondary {
  background-color: var(--ct-color-surface-card);
  color: var(--ct-color-text-primary);
  border-color: var(--ct-color-border);
}

.ct-btn-secondary:hover:not(:disabled) {
  background-color: var(--ct-color-surface-hover);
  border-color: var(--ct-color-border-focus);
  transform: translateY(-1px);
}

.ct-btn-secondary:active:not(:disabled) {
  transform: translateY(1px);
}

/* Danger style (Red attack styling) */
.ct-btn-danger {
  background-color: var(--ct-color-red);
  color: var(--ct-color-text-primary);
  border-color: var(--ct-color-red);
}

.ct-btn-danger:hover:not(:disabled) {
  background-color: #ff6666;
  border-color: #ff6666;
  transform: translateY(-1px);
}

.ct-btn-danger:active:not(:disabled) {
  transform: translateY(1px);
}

/* Disabled state */
.ct-btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none;
}
</style>
