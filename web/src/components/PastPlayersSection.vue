<script setup lang="ts">
import { inject, ref, watch, onUnmounted } from 'vue';
import { PLAYERS_API, EMPTY_PLAYERS_API } from '../api/players';
import { OBSERVER_FACTORY, defaultObserverFactory, type ScrollObserver } from '../api/observer';
import { usePastPlayers } from '../composables/usePastPlayers';
import PlayerRow from './PlayerRow.vue';

interface Props {
  /** Page size for the cursor pagination (overridable for tests). */
  pageSize?: number;
}
const props = withDefaults(defineProps<Props>(), { pageSize: 20 });

const api = inject(PLAYERS_API, EMPTY_PLAYERS_API);
const observerFactory = inject(OBSERVER_FACTORY, defaultObserverFactory);

const enabled = ref(false);
const { pastPlayers, isLoading, hasMore, loadMore } = usePastPlayers(api, enabled, props.pageSize);

const sentinel = ref<HTMLElement | null>(null);
let observer: ScrollObserver | null = null;

function enable(): void {
  enabled.value = true;
}

// Observe the sentinel whenever it (re)mounts; drop the observer when it goes away
// (e.g. once there are no more pages and the sentinel is removed).
watch(sentinel, (el) => {
  observer?.disconnect();
  observer = null;
  if (el) {
    observer = observerFactory(() => void loadMore());
    observer.observe(el);
  }
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <section class="past-players" aria-label="Players who have left">
    <button v-if="!enabled" type="button" class="toggle" @click="enable">
      Show players who left
    </button>

    <div v-else class="past-list">
      <p class="past-note">Players who have left the clan — most recent first.</p>
      <ul class="player-list">
        <PlayerRow v-for="p in pastPlayers" :key="p.tag" :player="p" />
      </ul>
      <div v-if="isLoading" class="past-status" role="status">Loading more…</div>
      <div v-if="hasMore" ref="sentinel" class="sentinel" aria-hidden="true"></div>
      <p v-else-if="pastPlayers.length === 0" class="past-status">No players have left.</p>
    </div>
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
  background: var(--ct-gradient-wood);
  border: 2px dashed var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-secondary);
  font-family: var(--ct-font-display);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  box-shadow: var(--ct-shadow-sm);
}
.toggle:hover,
.toggle:focus-visible {
  background: var(--ct-gradient-wood-light);
  border-color: var(--ct-color-gold);
  color: var(--ct-color-gold-text);
  outline: none;
}

.past-note {
  font-size: 12px;
  color: var(--ct-color-text-muted);
  margin: 0 0 var(--ct-spacing-sm) 2px;
}

.player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  background-color: var(--ct-color-surface-card);
  border: 1px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  overflow: hidden;
}

.past-status {
  padding: var(--ct-spacing-sm);
  text-align: center;
  font-size: 12px;
  color: var(--ct-color-text-secondary);
}

.sentinel {
  height: 1px;
}
</style>
