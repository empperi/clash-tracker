<script setup lang="ts">
import { computed, inject } from 'vue';
import { useSession } from '../composables/useSession';
import { PLAYERS_API, EMPTY_PLAYERS_API } from '../api/players';
import { usePlayers } from '../composables/usePlayers';
import BasePanel from '../components/BasePanel.vue';
import AcceptancePercentSlider from '../components/AcceptancePercentSlider.vue';
import MinWarParticipationSlider from '../components/MinWarParticipationSlider.vue';
import AdminInvitations from '../components/AdminInvitations.vue';

const { capabilities, loading: sessionLoading } = useSession();
const canInvite = computed(() => capabilities.value.canInviteAdmins);
const canEditThresholds = computed(() => capabilities.value.canEditThresholds);

// Only admins/owners see this view
const showAdminContent = computed(() => canInvite.value || canEditThresholds.value);

const api = inject(PLAYERS_API, EMPTY_PLAYERS_API);
const { thresholds, isLoading: playersLoading, isError } = usePlayers(api);
</script>

<template>
  <div v-if="!sessionLoading && showAdminContent" class="view-container">
    <h2>Admin Settings</h2>
    <p class="subtitle">
      Set thresholds for reliable rosters, invite administrators, and manage settings.
    </p>

    <div v-if="playersLoading" class="loading-state">
      <p>Loading thresholds...</p>
    </div>
    <div v-else-if="isError" class="error-state">
      <p>Failed to load thresholds from server.</p>
    </div>
    <div v-else class="admin-sections">
      <!-- Roster Thresholds Panel -->
      <BasePanel v-if="canEditThresholds" title="Roster Thresholds">
        <AcceptancePercentSlider :model-value="thresholds.acceptancePct" />
        <MinWarParticipationSlider :model-value="thresholds.minWarParticipation" />
      </BasePanel>

      <!-- Invitations Section -->
      <AdminInvitations />
    </div>
  </div>
  <div v-else-if="!sessionLoading" class="unauthorized-container">
    <BasePanel title="Access Denied">
      <p class="unauthorized-text">You must be an administrator or owner to view this page.</p>
    </BasePanel>
  </div>
  <div v-else class="loading-state">
    <p>Loading session...</p>
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

.admin-sections {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-md);
}

.loading-state,
.error-state {
  text-align: center;
  color: var(--ct-color-text-secondary);
  padding: var(--ct-spacing-lg) 0;
  font-family: var(--ct-font-body);
}

.error-state {
  color: #f44336;
}

.unauthorized-container {
  padding: var(--ct-spacing-md);
  max-width: 600px;
  margin: var(--ct-spacing-xl) auto 0;
}

.unauthorized-text {
  color: var(--ct-color-text-secondary);
  font-family: var(--ct-font-body);
  font-size: 15px;
  line-height: 1.6;
}
</style>
