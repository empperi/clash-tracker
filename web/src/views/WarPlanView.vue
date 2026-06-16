<script setup lang="ts">
import BasePanel from '../components/BasePanel.vue';
import ListRow from '../components/ListRow.vue';
import BaseButton from '../components/BaseButton.vue';
</script>

<template>
  <div class="view-container">
    <h2>War Plan (CWL)</h2>
    <p class="subtitle">Select line-ups, manage town hall swaps, and generate optimal strategy.</p>

    <BasePanel title="Active CWL War Plan" :no-padding="true">
      <div class="sync-status">
        <span class="status-indicator">🟢</span>
        <span class="status-text">Synced with game data</span>
      </div>

      <div class="war-list">
        <ListRow clickable>
          <div class="war-row">
            <span class="war-title">⚔️ War #1 vs Dark Avengers</span>
            <span class="war-badge success">Won (42-38)</span>
          </div>
        </ListRow>

        <ListRow clickable active>
          <div class="war-row">
            <span class="war-title">⚔️ War #2 vs Clash Kings</span>
            <span class="war-badge in-progress">In Progress</span>
          </div>
        </ListRow>

        <ListRow clickable>
          <div class="war-row">
            <span class="war-title">⚔️ War #3 vs Gold Rushers</span>
            <span class="war-badge pending">Pending</span>
          </div>
        </ListRow>
      </div>

      <template #footer>
        <div class="panel-actions">
          <BaseButton variant="primary">Auto-Plan Roster</BaseButton>
        </div>
      </template>
    </BasePanel>
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

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-xs);
  margin: var(--ct-spacing-md);
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-well);
  border-radius: var(--ct-radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.02);
  font-size: 13px;
  color: var(--ct-color-text-primary);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.war-list {
  display: flex;
  flex-direction: column;
}

.war-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.war-title {
  font-family: var(--ct-font-display);
  font-weight: 600;
  font-size: 15px;
}

.war-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--ct-radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.war-badge.success {
  background-color: rgba(55, 214, 122, 0.12);
  color: var(--ct-color-green);
  border: 1px solid rgba(55, 214, 122, 0.2);
}

.war-badge.in-progress {
  background-color: rgba(255, 194, 0, 0.12);
  color: var(--ct-color-gold-text);
  border: 1px solid rgba(255, 194, 0, 0.2);
}

.war-badge.pending {
  background-color: rgba(0, 0, 0, 0.3);
  color: var(--ct-color-text-muted);
  border: 1px solid var(--ct-color-border);
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
