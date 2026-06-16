<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Player } from '@clash-tracker/core';
import { roleLabel } from '../utils/format';

interface Props {
  player: Player;
  /** Above the qualification line (CWL-eligible). */
  qualified?: boolean;
}
const props = withDefaults(defineProps<Props>(), { qualified: false });

const expanded = ref(false);
const detailId = computed(() => `player-detail-${props.player.tag.replace(/[^a-z0-9]/gi, '')}`);

function toggle(): void {
  expanded.value = !expanded.value;
}
</script>

<template>
  <li class="player-row" :class="{ 'is-qualified': qualified }">
    <button
      type="button"
      class="row-main"
      style="min-height: 44px"
      :aria-expanded="expanded"
      :aria-controls="detailId"
      @click="toggle"
    >
      <span v-if="qualified" class="qualified-badge" aria-hidden="true">★</span>
      <span class="identity">
        <span class="name">
          {{ player.name }}
          <span v-if="qualified" class="visually-hidden">(above the line)</span>
        </span>
        <span class="meta">
          <span class="role">{{ roleLabel(player.role) }}</span>
          <span class="dot" aria-hidden="true">·</span>
          <span class="th" :aria-label="`Town Hall level ${player.thLevel}`"
            >TH{{ player.thLevel }}</span
          >
        </span>
      </span>
      <span class="metrics">
        <span class="usage" :aria-label="`${player.stats.attackUsagePct}% attacks used`"
          >{{ player.stats.attackUsagePct }}%</span
        >
        <span class="wars">{{ player.stats.warsParticipated }} wars</span>
      </span>
      <span class="chevron" :class="{ 'is-expanded': expanded }" aria-hidden="true">▼</span>
    </button>

    <dl v-show="expanded" :id="detailId" class="row-detail">
      <div class="stat">
        <dt>Attacks done</dt>
        <dd>{{ player.stats.attacksDone }} / {{ player.stats.attacksAvailable }}</dd>
      </div>
      <div class="stat">
        <dt>Median stars</dt>
        <dd>{{ player.stats.medianStars }}★</dd>
      </div>
      <div class="stat">
        <dt>Median destruction</dt>
        <dd>{{ player.stats.medianDestruction }}%</dd>
      </div>
      <div class="stat">
        <dt>Median defenses</dt>
        <dd>{{ player.stats.medianDefenses }}</dd>
      </div>
      <div class="stat">
        <dt>Median own dest.</dt>
        <dd>{{ player.stats.medianOwnDestruction }}%</dd>
      </div>
    </dl>
  </li>
</template>

<style scoped>
.player-row {
  list-style: none;
  border-bottom: 1px solid var(--ct-color-border);
  background-color: transparent;
  transition: background-color 0.15s ease;
}
.player-row:last-child {
  border-bottom: none;
}

/* Above-the-line players: a subtle gold wash plus the star badge + label */
.is-qualified {
  background: var(--ct-gradient-gold-soft);
  position: relative;
}

.is-qualified::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--ct-gradient-gold);
}

.row-main {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-md);
  width: 100%;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--ct-color-text-primary);
  font-size: 15px;
  transition: background-color 0.15s ease;
}

.row-main:hover,
.row-main:focus-visible {
  background-color: var(--ct-color-surface-hover);
  outline: none;
}

.qualified-badge {
  color: var(--ct-color-gold);
  font-size: 18px;
  flex: 0 0 auto;
  text-shadow: 0 0 6px rgba(255, 194, 0, 0.6);
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0.9; }
}

/* Identity block */
.identity {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.name {
  font-family: var(--ct-font-display);
  font-weight: 600;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ct-color-text-secondary);
  margin-top: 2px;
}
.meta .dot {
  color: var(--ct-color-text-muted);
}
.meta .th {
  color: var(--ct-color-gold-text);
  font-weight: 600;
  background-color: var(--ct-gradient-badge);
  background: var(--ct-gradient-badge);
  padding: 1px 6px;
  border-radius: var(--ct-radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 10px;
  text-transform: uppercase;
}

/* Metrics block: right-aligned. */
.metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: 0 0 auto;
  margin-left: auto;
}

.usage {
  font-family: var(--ct-font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--ct-color-gold-text);
  line-height: 1.1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.wars {
  font-size: 11px;
  color: var(--ct-color-text-muted);
  margin-top: 2px;
}

.chevron {
  color: var(--ct-color-text-muted);
  font-size: 10px;
  flex: 0 0 auto;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
  display: inline-block;
  padding: 4px;
}

.chevron.is-expanded {
  transform: rotate(180deg);
  color: var(--ct-color-gold);
}

/* Desktop enhancement */
@media (min-width: 700px) {
  .row-main {
    padding: var(--ct-spacing-md);
    font-size: 16px;
  }
  .row-detail {
    grid-template-columns: repeat(5, 1fr) !important;
  }
}

.row-detail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ct-spacing-sm);
  margin: 0;
  padding: var(--ct-spacing-md);
  background-color: var(--ct-color-surface-well);
  border-top: 1px solid rgba(0, 0, 0, 0.2);
  box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.3);
}

.row-detail .stat {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-xs);
  font-size: 13px;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: var(--ct-radius-sm);
  padding: var(--ct-spacing-sm);
}

.row-detail dt {
  color: var(--ct-color-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-weight: 600;
}

.row-detail dd {
  margin: 0;
  font-weight: 700;
  color: var(--ct-color-text-primary);
  font-size: 15px;
  font-family: var(--ct-font-display);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
