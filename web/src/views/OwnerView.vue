<script setup lang="ts">
import BasePanel from '../components/BasePanel.vue';
import BaseButton from '../components/BaseButton.vue';
</script>

<template>
  <div class="view-container">
    <h2>Owner Dashboard</h2>
    <p class="subtitle">
      Configure your Clash of Clans API token, edit your clan tag, and manage accounts.
    </p>

    <BasePanel title="Clan Configuration">
      <div class="config-form">
        <div class="form-group">
          <label for="clanTag" class="form-label">Clan Tag</label>
          <input
            id="clanTag"
            type="text"
            value="#2QYY0YY09"
            placeholder="#CLAN_TAG"
            class="form-control"
            readonly
          />
        </div>

        <div class="form-group">
          <label for="apiToken" class="form-label">CoC API Token</label>
          <input
            id="apiToken"
            type="password"
            value="••••••••••••••••••••"
            placeholder="API Token from developer.clashofclans.com"
            class="form-control"
            readonly
          />
        </div>
      </div>

      <template #footer>
        <div class="panel-actions">
          <BaseButton variant="secondary">Edit</BaseButton>
          <BaseButton variant="primary">Save Configuration</BaseButton>
        </div>
      </template>
    </BasePanel>

    <BasePanel title="Danger Zone">
      <p class="danger-text">These settings have critical security impacts. Be careful.</p>
      <div class="panel-actions justify-start">
        <BaseButton variant="danger">Revoke All Admin Sessions</BaseButton>
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

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-xs);
}

.form-label {
  font-family: var(--ct-font-display);
  font-size: 14px;
  color: var(--ct-color-gold-text);
}

.form-control {
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: var(--ct-color-surface-well);
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-primary);
  font-family: var(--ct-font-body);
  font-size: 15px;
}

.form-control:focus {
  border-color: var(--ct-color-border-focus);
  outline: none;
}

.danger-text {
  font-size: 14px;
  color: var(--ct-color-text-primary);
  margin-top: 0;
  margin-bottom: var(--ct-spacing-md);
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ct-spacing-sm);
}

.justify-start {
  justify-content: flex-start;
}
</style>
