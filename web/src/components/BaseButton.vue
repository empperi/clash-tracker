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
    style="min-height: 44px"
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
  min-width: 44px; /* Touch target minimum requirement */
  padding: var(--ct-spacing-sm) var(--ct-spacing-lg);
  font-family: var(--ct-font-display);
  font-size: 15px;
  font-weight: 700;
  border-radius: var(--ct-radius-md);
  cursor: pointer;
  transition:
    background-color 0.1s ease,
    transform 0.05s ease,
    border-bottom-width 0.05s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  user-select: none;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Primary style (Gold-on-wood theme) */
.ct-btn-primary {
  background: var(--ct-gradient-gold);
  color: #130a05; /* Dark contrast */
  border: 2px solid #ffcc00;
  border-bottom: 5px solid #b38600;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
}

.ct-btn-primary:hover:not(:disabled) {
  background: var(--ct-gradient-gold-hover);
}

.ct-btn-primary:active:not(:disabled) {
  transform: translateY(3px);
  border-bottom-width: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* Secondary style (Stone/Wood theme) */
.ct-btn-secondary {
  background: linear-gradient(to bottom, #4a311c, #322012);
  color: var(--ct-color-text-primary);
  border: 2px solid var(--ct-color-border);
  border-bottom: 5px solid #1a0f07;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.ct-btn-secondary:hover:not(:disabled) {
  background: linear-gradient(to bottom, #593d25, #3d2817);
  border-color: var(--ct-color-border-focus);
}

.ct-btn-secondary:active:not(:disabled) {
  transform: translateY(3px);
  border-bottom-width: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* Danger style (Red attack styling) */
.ct-btn-danger {
  background: linear-gradient(to bottom, #ff5353, #d91a1a);
  color: #ffffff;
  border: 2px solid #ff7373;
  border-bottom: 5px solid #8c0d0d;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.ct-btn-danger:hover:not(:disabled) {
  background: linear-gradient(to bottom, #ff7373, #f22929);
}

.ct-btn-danger:active:not(:disabled) {
  transform: translateY(3px);
  border-bottom-width: 2px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

/* Disabled state */
.ct-btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  border-bottom-width: 5px !important;
  box-shadow: none;
}
</style>
