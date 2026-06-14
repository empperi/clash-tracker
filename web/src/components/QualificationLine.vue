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
    <span class="line-icon" aria-hidden="true">⚔️</span>
    <span class="line-label">CWL line · {{ acceptancePct }}% attacks</span>
  </div>
</template>

<style scoped>
.qualification-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--ct-spacing-sm);
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  /* A solid, unmistakable divider — paired with the icon + label below it so the
     meaning never relies on color alone. */
  border-top: 3px solid var(--ct-color-gold);
  border-bottom: 3px solid var(--ct-color-gold);
  background-color: var(--ct-color-gold-light);
}

.line-icon {
  font-size: 14px;
}

.line-label {
  font-family: var(--ct-font-display);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ct-color-gold-text);
}
</style>
