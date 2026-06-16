<script setup lang="ts">
interface Props {
  /** Acceptance Percentage Level the line marks. */
  acceptancePct: number;
}
defineProps<Props>();
</script>

<template>
  <div
    class="qualification-line"
    role="separator"
    :aria-label="`CWL qualification line at ${acceptancePct}% attack usage`"
  >
    <div class="line-content">
      <span class="line-icon" aria-hidden="true">⚔️</span>
      <span class="line-label">CWL line · {{ acceptancePct }}% attacks</span>
    </div>
  </div>
</template>

<style scoped>
.qualification-line {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ct-spacing-md) 0;
  background-color: transparent;
  position: relative;
  overflow: hidden;
}

/* Horizontal split line running across the background */
.qualification-line::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgba(68, 42, 23, 0.2) 0%,
    var(--ct-color-border) 25%,
    var(--ct-color-gold) 50%,
    var(--ct-color-border) 75%,
    rgba(68, 42, 23, 0.2) 100%
  );
  transform: translateY(-50%);
  z-index: 1;
}

.line-content {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-xs);
  padding: 4px var(--ct-spacing-md);
  background: var(--ct-gradient-badge);
  border: 1px solid var(--ct-color-gold);
  border-radius: var(--ct-radius-xl);
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  position: relative;
}

.line-icon {
  font-size: 14px;
}

.line-label {
  font-family: var(--ct-font-display);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ct-color-gold-text);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
