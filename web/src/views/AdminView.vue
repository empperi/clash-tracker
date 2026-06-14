<script setup lang="ts">
import BasePanel from '../components/BasePanel.vue';
import BaseButton from '../components/BaseButton.vue';
</script>

<template>
  <div class="view-container">
    <h2>Admin Settings</h2>
    <p class="subtitle">Set thresholds for reliable rosters, invite administrators, and manage settings.</p>
    
    <BasePanel title="Roster Thresholds">
      <div class="setting-item">
        <label class="setting-label">Acceptance Percentage</label>
        <div class="slider-container">
          <input type="range" min="0" max="100" value="80" disabled />
          <span class="value-display">80% (Locked)</span>
        </div>
        <p class="setting-help">Minimum attack utilization expected from rostered members.</p>
      </div>

      <div class="setting-item">
        <label class="setting-label">Min War Participation</label>
        <div class="slider-container">
          <input type="range" min="0" max="10" value="3" disabled />
          <span class="value-display">3 Wars (Locked)</span>
        </div>
        <p class="setting-help">Number of regular wars a member must participate in to qualify.</p>
      </div>
    </BasePanel>

    <BasePanel title="Administrator Invites">
      <p class="invite-info">Invite other members as admins to help manage the war plans.</p>
      <div class="invite-actions">
        <BaseButton variant="secondary">Create Invite Link</BaseButton>
      </div>
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

.setting-item {
  margin-bottom: var(--ct-spacing-lg);
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-label {
  display: block;
  font-family: var(--ct-font-display);
  font-size: 15px;
  color: var(--ct-color-gold-text);
  margin-bottom: var(--ct-spacing-xs);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-md);
}

.slider-container input {
  flex: 1;
  accent-color: var(--ct-color-gold);
}

.value-display {
  font-family: var(--ct-font-display);
  font-weight: 600;
  font-size: 14px;
  color: var(--ct-color-text-primary);
  min-width: 80px;
}

.setting-help {
  font-size: 12px;
  color: var(--ct-color-text-muted);
  margin: var(--ct-spacing-xs) 0 0 0;
}

.invite-info {
  font-size: 14px;
  color: var(--ct-color-text-primary);
  margin-top: 0;
  margin-bottom: var(--ct-spacing-md);
}

.invite-actions {
  display: flex;
}
</style>
