<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { PLAYERS_API, EMPTY_PLAYERS_API } from '../api/players';
import { CAN_VIEW_PAST_PLAYERS } from '../api/session';
import { usePlayers } from '../composables/usePlayers';
import { usePlayerLists } from '../composables/usePlayerLists';
import PlayerRow from '../components/PlayerRow.vue';
import QualificationLine from '../components/QualificationLine.vue';
import PastPlayersSection from '../components/PastPlayersSection.vue';
import BasePanel from '../components/BasePanel.vue';

const api = inject(PLAYERS_API, EMPTY_PLAYERS_API);
const canViewPastPlayers = inject(CAN_VIEW_PAST_PLAYERS, ref(false));
const { players, thresholds, isLoading, isError } = usePlayers(api);
const { qualifiedAbove, qualifiedBelow, notEnoughWars } = usePlayerLists(players, thresholds);

const isEmpty = computed(() => !isLoading.value && !isError.value && players.value.length === 0);
const hasQualifiedList = computed(
  () => qualifiedAbove.value.length > 0 || qualifiedBelow.value.length > 0
);
</script>

<template>
  <div class="view-container">
    <h2>Player List</h2>
    <p class="subtitle">Who's pulling their weight — and who's above the CWL line.</p>

    <div v-if="isLoading" class="state-loading" role="status">Loading roster…</div>

    <div v-else-if="isError" class="state-error" role="alert">
      Couldn't load the roster. Pull to refresh or try again shortly.
    </div>

    <div v-else-if="isEmpty" class="state-empty">
      No tracked players yet. Stats appear here after the first war is ingested.
    </div>

    <template v-else>
      <BasePanel v-if="hasQualifiedList" title="Qualified pool">
        <ul class="player-list">
          <PlayerRow v-for="p in qualifiedAbove" :key="p.tag" :player="p" :qualified="true" />
          <li class="line-item">
            <QualificationLine :acceptance-pct="thresholds.acceptancePct" />
          </li>
          <PlayerRow v-for="p in qualifiedBelow" :key="p.tag" :player="p" />
        </ul>
      </BasePanel>

      <BasePanel v-if="notEnoughWars.length > 0" title="Not enough wars">
        <ul class="player-list">
          <PlayerRow v-for="p in notEnoughWars" :key="p.tag" :player="p" />
        </ul>
      </BasePanel>

      <PastPlayersSection v-if="canViewPastPlayers" />
    </template>
  </div>
</template>

<style scoped>
.view-container {
  padding: var(--ct-spacing-md);
  max-width: 600px;
  margin: 0 auto;
}

.subtitle {
  color: var(--ct-color-text-secondary);
  font-size: 14px;
  margin-bottom: var(--ct-spacing-md);
}

.player-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.line-item {
  list-style: none;
}

.state-loading,
.state-error,
.state-empty {
  padding: var(--ct-spacing-lg);
  text-align: center;
  border-radius: var(--ct-radius-md);
  background-color: var(--ct-color-surface-card);
  border: 1px solid var(--ct-color-border);
  color: var(--ct-color-text-secondary);
}

.state-error {
  color: var(--ct-color-red);
  border-color: var(--ct-color-red);
}
</style>
