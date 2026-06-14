<script setup lang="ts">
import BasePanel from '../components/BasePanel.vue';
import ListRow from '../components/ListRow.vue';
import BaseButton from '../components/BaseButton.vue';
</script>

<template>
  <div class="view-container">
    <h2>War Plan (CWL)</h2>
    <p class="subtitle">Select line-ups, manage town hall swaps, and generate optimal strategy.</p>
    
    <BasePanel title="Active CWL War Plan">
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
  margin-bottom: var(--ct-spacing-md);
  padding: var(--ct-spacing-xs) var(--ct-spacing-sm);
  background-color: var(--ct-color-surface-well);
  border-radius: var(--ct-radius-sm);
  font-size: 13px;
  color: var(--ct-color-text-primary);
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
  font-weight: 500;
}

.war-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--ct-radius-sm);
  text-transform: uppercase;
}

.war-badge.success {
  background-color: var(--ct-color-green-light);
  color: var(--ct-color-green);
}

.war-badge.in-progress {
  background-color: var(--ct-color-gold-light);
  color: var(--ct-color-gold);
}

.war-badge.pending {
  background-color: var(--ct-color-surface-well);
  color: var(--ct-color-text-muted);
  border: 1px solid var(--ct-color-border);
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
