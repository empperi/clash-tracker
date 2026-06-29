<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useSession } from '../composables/useSession';
import { PLAYERS_API, EMPTY_PLAYERS_API } from '../api/players';
import { OWNER_API, EMPTY_OWNER_API } from '../api/owner';
import { useClanConfig } from '../composables/useClanConfig';
import { validateClanName, validateConfigClanTag } from '@clash-tracker/core';
import BasePanel from '../components/BasePanel.vue';
import BaseButton from '../components/BaseButton.vue';

const { loading: sessionLoading, capabilities } = useSession();

const playersApi = inject(PLAYERS_API, EMPTY_PLAYERS_API);
const ownerApi = inject(OWNER_API, EMPTY_OWNER_API);
const queryClient = useQueryClient();

const { config, isLoading: configLoading, isError: configError } = useClanConfig(playersApi);

const clanNameInput = ref('');
const clanTagInput = ref('');

// Validation/Save States
const nameError = ref('');
const nameSuccess = ref(false);
const tagError = ref('');
const tagSuccess = ref(false);

const isSavingName = ref(false);
const isSavingTag = ref(false);

// Keep inputs in sync with query data
watch(
  config,
  (newConfig) => {
    if (newConfig) {
      clanNameInput.value = newConfig.clanName || '';
      clanTagInput.value = newConfig.clanTag || '';
    }
  },
  { immediate: true }
);

async function saveClanName() {
  nameError.value = '';
  nameSuccess.value = false;

  const validation = validateClanName(clanNameInput.value);
  if (!validation.success) {
    nameError.value = validation.error;
    return;
  }

  isSavingName.value = true;
  try {
    await ownerApi.setClanName(validation.value);
    nameSuccess.value = true;
    await queryClient.invalidateQueries({ queryKey: ['settings', 'config'] });
  } catch (err: unknown) {
    nameError.value = err instanceof Error ? err.message : 'Failed to update clan name';
  } finally {
    isSavingName.value = false;
  }
}

async function saveClanTag() {
  tagError.value = '';
  tagSuccess.value = false;

  const validation = validateConfigClanTag(clanTagInput.value);
  if (!validation.success) {
    tagError.value = validation.error;
    return;
  }

  isSavingTag.value = true;
  try {
    // Note: This is a non-atomic dual-write (updates secrets/coc then publicSettings/config on server).
    // If the second write fails, it returns a 500 error but the secrets record remains updated.
    await ownerApi.setClanTag(validation.value);
    tagSuccess.value = true;
    clanTagInput.value = validation.value; // display normalized
    await queryClient.invalidateQueries({ queryKey: ['settings', 'config'] });
  } catch (err: unknown) {
    tagError.value = err instanceof Error ? err.message : 'Failed to update clan tag';
  } finally {
    isSavingTag.value = false;
  }
}
</script>

<template>
  <div class="view-container">
    <!-- Session Loading -->
    <div v-if="sessionLoading" class="loading-state">
      <span class="spinner"></span>
      <p>Loading session...</p>
    </div>

    <!-- Access Denied -->
    <div v-else-if="!capabilities.isOwner" class="denied-state">
      <div class="denied-icon">🛡️</div>
      <h3>Access Denied</h3>
      <p>You must be the owner to view this page.</p>
    </div>

    <div v-else>
      <h2>Owner Dashboard</h2>
      <p class="subtitle">
        Configure your Clash of Clans API token, edit your clan tag, and manage accounts.
      </p>

      <!-- Config Loading -->
      <div v-if="configLoading" class="loading-state">
        <span class="spinner"></span>
        <p>Loading configuration...</p>
      </div>

      <!-- Config Error -->
      <div v-else-if="configError" class="error-state">
        <p class="error-text">Failed to load configuration from server.</p>
      </div>

      <!-- Config Form -->
      <div v-else class="owner-sections">
        <BasePanel title="Clan Configuration">
          <div class="config-form">
            <!-- Clan Name Field -->
            <div class="form-group">
              <label for="clanName" class="form-label">Clan Name</label>
              <div class="input-with-button">
                <input
                  id="clanName"
                  v-model="clanNameInput"
                  type="text"
                  placeholder="Clan Name"
                  class="form-control"
                />
                <BaseButton
                  variant="primary"
                  class="save-name-btn"
                  :disabled="isSavingName"
                  @click="saveClanName"
                >
                  {{ isSavingName ? 'Saving...' : 'Save Name' }}
                </BaseButton>
              </div>
              <p v-if="nameError" class="validation-message name-error">{{ nameError }}</p>
              <p v-if="nameSuccess" class="validation-message name-success">Name saved successfully!</p>
            </div>

            <!-- Clan Tag Field -->
            <div class="form-group">
              <label for="clanTag" class="form-label">Clan Tag</label>
              <div class="input-with-button">
                <input
                  id="clanTag"
                  v-model="clanTagInput"
                  type="text"
                  placeholder="#CLAN_TAG"
                  class="form-control"
                />
                <BaseButton
                  variant="primary"
                  class="save-tag-btn"
                  :disabled="isSavingTag"
                  @click="saveClanTag"
                >
                  {{ isSavingTag ? 'Saving...' : 'Save Tag' }}
                </BaseButton>
              </div>
              <p v-if="tagError" class="validation-message tag-error">{{ tagError }}</p>
              <p v-if="tagSuccess" class="validation-message tag-success">Tag saved successfully!</p>
            </div>
          </div>
        </BasePanel>

        <BasePanel title="Danger Zone">
          <p class="danger-text">These settings have critical security impacts. Be careful.</p>
          <div class="panel-actions justify-start">
            <BaseButton variant="danger" :disabled="true">Revoke All Admin Sessions (Coming Soon)</BaseButton>
          </div>
        </BasePanel>
      </div>
    </div>
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

.owner-sections {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-lg);
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-lg);
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

.input-with-button {
  display: flex;
  gap: var(--ct-spacing-sm);
}

.input-with-button .form-control {
  flex: 1;
}

.form-control {
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  background-color: #130a05;
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-primary);
  font-family: var(--ct-font-body);
  font-size: 15px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  min-height: 44px;
}

.form-control:focus {
  border-color: var(--ct-color-border-focus);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.4),
    0 0 8px rgba(255, 194, 0, 0.25);
  outline: none;
}

.validation-message {
  font-size: 13px;
  margin: 4px 0 0 0;
  font-family: var(--ct-font-body);
}

.name-error, .tag-error {
  color: var(--ct-color-red);
}

.name-success, .tag-success {
  color: var(--ct-color-green);
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

.loading-state, .denied-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ct-spacing-xl);
  text-align: center;
  background: var(--ct-gradient-wood);
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  box-shadow: var(--ct-shadow-md);
  margin-top: var(--ct-spacing-lg);
}

.denied-icon {
  font-size: 48px;
  margin-bottom: var(--ct-spacing-sm);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 4px solid var(--ct-color-border);
  border-top-color: var(--ct-color-gold);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--ct-spacing-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
