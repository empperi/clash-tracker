<script setup lang="ts">
import BasePanel from '../components/BasePanel.vue';
import ListRow from '../components/ListRow.vue';
import BaseButton from '../components/BaseButton.vue';
</script>

<template>
  <div class="view-container">
    <h2>Player List</h2>
    <p class="subtitle">Track participation to select the most reliable CWL roster.</p>
    
    <BasePanel title="Roster Eligibility (Mock Data)">
      <div class="list-header">
        <span>Player</span>
        <span class="align-right">War Participation</span>
      </div>
      
      <ListRow active>
        <div class="player-row">
          <span class="player-name">👑 Barbarian King</span>
          <span class="tag-qualified">Qualified</span>
          <span class="participation-pct align-right">100%</span>
        </div>
      </ListRow>
      
      <ListRow>
        <div class="player-row">
          <span class="player-name">🏹 Archer Queen</span>
          <span class="tag-qualified">Qualified</span>
          <span class="participation-pct align-right">85%</span>
        </div>
      </ListRow>
      
      <div class="qualification-line">
        <span class="qualification-label">⚠️ Roster Qualification Cutoff (70%)</span>
      </div>
      
      <ListRow>
        <div class="player-row below-cutoff">
          <span class="player-name">✨ Grand Warden</span>
          <span class="tag-unqualified">Below Threshold</span>
          <span class="participation-pct align-right">50%</span>
        </div>
      </ListRow>
      
      <ListRow>
        <div class="player-row below-cutoff">
          <span class="player-name">🛡️ Royal Champion</span>
          <span class="tag-unqualified">Below Threshold</span>
          <span class="participation-pct align-right">40%</span>
        </div>
      </ListRow>
      
      <template #footer>
        <div class="panel-actions">
          <BaseButton variant="primary">Sync Members</BaseButton>
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

.list-header {
  display: flex;
  justify-content: space-between;
  padding: var(--ct-spacing-xs) var(--ct-spacing-sm);
  font-family: var(--ct-font-display);
  font-size: 12px;
  color: var(--ct-color-text-muted);
  text-transform: uppercase;
  border-bottom: 2px solid var(--ct-color-border);
  margin-bottom: var(--ct-spacing-xs);
}

.player-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.player-name {
  font-family: var(--ct-font-display);
  font-weight: 500;
  flex: 1;
}

.tag-qualified {
  background-color: var(--ct-color-green-light);
  color: var(--ct-color-green);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--ct-radius-sm);
  margin-right: var(--ct-spacing-md);
}

.tag-unqualified {
  background-color: var(--ct-color-red-light);
  color: var(--ct-color-red);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--ct-radius-sm);
  margin-right: var(--ct-spacing-md);
}

.participation-pct {
  font-family: var(--ct-font-display);
  font-weight: 600;
  color: var(--ct-color-gold-text);
  width: 50px;
}

.align-right {
  text-align: right;
}

.qualification-line {
  border-top: 2px dashed var(--ct-color-red);
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  margin: var(--ct-spacing-xs) 0;
  background-color: rgba(255, 77, 77, 0.05);
  border-radius: var(--ct-radius-sm);
  display: flex;
  justify-content: center;
}

.qualification-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ct-color-red);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.below-cutoff {
  opacity: 0.75;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
