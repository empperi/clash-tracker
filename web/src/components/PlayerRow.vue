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
      <span class="chevron" aria-hidden="true">{{ expanded ? '▲' : '▼' }}</span>
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
        <dt>Median own destruction</dt>
        <dd>{{ player.stats.medianOwnDestruction }}%</dd>
      </div>
    </dl>
  </li>
</template>

<style scoped>
.player-row {
  list-style: none;
  border-bottom: 1px solid var(--ct-color-border);
  background-color: var(--ct-color-surface-card);
}
.player-row:last-child {
  border-bottom: none;
}

/* Above-the-line players: a subtle gold wash plus the star badge + label
   (never color alone — see the badge and visually-hidden text). */
.is-qualified {
  background-color: var(--ct-color-gold-light);
  border-left: 3px solid var(--ct-color-gold);
}

.row-main {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-sm);
  width: 100%;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--ct-color-text-primary);
  font-size: 15px;
}

.qualified-badge {
  color: var(--ct-color-gold);
  font-size: 16px;
  flex: 0 0 auto;
}

/* Identity block: name on top, role · TH beneath — keeps the row scannable and
   wrap-free at 360px. */
.identity {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.name {
  font-family: var(--ct-font-display);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ct-color-text-secondary);
}
.meta .dot {
  color: var(--ct-color-text-muted);
}
.meta .th {
  color: var(--ct-color-gold-text);
  font-weight: 600;
}

/* Metrics block: headline usage % with wars beneath, right-aligned. */
.metrics {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: 0 0 auto;
}

.usage {
  font-family: var(--ct-font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--ct-color-gold-text);
  line-height: 1.1;
}

.wars {
  font-size: 12px;
  color: var(--ct-color-text-muted);
}

.chevron {
  color: var(--ct-color-text-muted);
  font-size: 10px;
  flex: 0 0 auto;
}

/* Desktop enhancement: roomier rows and a larger detail grid. */
@media (min-width: 700px) {
  .row-main {
    padding: var(--ct-spacing-md);
    font-size: 16px;
  }
  .row-detail {
    grid-template-columns: repeat(3, 1fr);
  }
}

.row-detail {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--ct-spacing-xs) var(--ct-spacing-md);
  margin: 0;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-well);
}
.row-detail .stat {
  display: flex;
  justify-content: space-between;
  gap: var(--ct-spacing-sm);
  font-size: 13px;
}
.row-detail dt {
  color: var(--ct-color-text-muted);
}
.row-detail dd {
  margin: 0;
  font-weight: 600;
  color: var(--ct-color-text-primary);
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
