<script setup lang="ts">
import { ref, inject, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useSession } from '../composables/useSession';
import { PLAYERS_API, EMPTY_PLAYERS_API } from '../api/players';
import { OWNER_API, EMPTY_OWNER_API } from '../api/owner';
import { useClanConfig } from '../composables/useClanConfig';
import { validateClanName, validateConfigClanTag, validateApiToken } from '@clash-tracker/core';
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

// API Token Config
const apiTokenInput = ref('');
const apiTokenError = ref('');
const apiTokenSuccess = ref(false);
const isSavingApiToken = ref(false);
const hasApiToken = ref(false);
const isLoadingTokenStatus = ref(false);

async function fetchTokenStatus() {
  if (!capabilities.value.isOwner) return;
  isLoadingTokenStatus.value = true;
  try {
    hasApiToken.value = await ownerApi.getApiTokenStatus();
  } catch (err: unknown) {
    console.error('Failed to fetch API token status:', err);
  } finally {
    isLoadingTokenStatus.value = false;
  }
}

// Fetch status when capabilities or session changes
watch(
  () => capabilities.value.isOwner,
  (isOwner) => {
    if (isOwner) {
      fetchTokenStatus();
    }
  },
  { immediate: true }
);

async function saveApiToken() {
  apiTokenError.value = '';
  apiTokenSuccess.value = false;

  const validation = validateApiToken(apiTokenInput.value);
  if (!validation.success) {
    apiTokenError.value = validation.error;
    return;
  }

  isSavingApiToken.value = true;
  try {
    await ownerApi.setApiToken(validation.value);
    apiTokenSuccess.value = true;
    apiTokenInput.value = ''; // clear plaintext input immediately on success
    await fetchTokenStatus(); // refresh status indicator
  } catch (err: unknown) {
    apiTokenError.value = err instanceof Error ? err.message : 'Failed to update API token';
  } finally {
    isSavingApiToken.value = false;
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
    <div v-else-if="!capabilities.isOwner" class="unauthorized-container">
      <BasePanel title="Access Denied">
        <div class="denied-content">
          <div class="denied-icon">🛡️</div>
          <p class="unauthorized-text">You must be the owner to view this page.</p>
        </div>
      </BasePanel>
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

        <BasePanel title="CoC API Token">
          <p class="section-description">
            Set or rotate your Clash of Clans API token. This token is stored encrypted at rest and is never sent back to the browser.
          </p>
          <div class="config-form">
            <div class="form-group">
              <div class="token-status-indicator">
                <span>Status:</span>
                <span v-if="isLoadingTokenStatus" class="token-loading-text">Checking status...</span>
                <span v-else-if="hasApiToken" class="token-status-badge is-set">Active (Set)</span>
                <span v-else class="token-status-badge is-empty">Not configured</span>
              </div>
              <div class="input-with-button">
                <input
                  id="apiToken"
                  v-model="apiTokenInput"
                  type="password"
                  placeholder="Paste CoC API token"
                  class="form-control"
                  autocomplete="new-password"
                />
                <BaseButton
                  variant="primary"
                  class="save-token-btn"
                  :disabled="isSavingApiToken"
                  @click="saveApiToken"
                >
                  {{ isSavingApiToken ? 'Saving...' : 'Save Token' }}
                </BaseButton>
              </div>
              <p v-if="apiTokenError" class="validation-message token-error">{{ apiTokenError }}</p>
              <p v-if="apiTokenSuccess" class="validation-message token-success">API token saved successfully!</p>
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

.name-error, .tag-error, .token-error {
  color: var(--ct-color-red);
}

.name-success, .tag-success, .token-success {
  color: var(--ct-color-green);
}

.token-status-indicator {
  font-size: 13px;
  margin-bottom: var(--ct-spacing-xs);
  color: var(--ct-color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-xs);
}

.token-status-badge {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--ct-radius-sm);
  font-size: 12px;
}

.token-status-badge.is-set {
  background-color: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.token-status-badge.is-empty {
  background-color: rgba(244, 67, 54, 0.15);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.token-loading-text {
  font-style: italic;
  opacity: 0.8;
}

.section-description {
  font-size: 14px;
  color: var(--ct-color-text-secondary);
  margin-top: 0;
  margin-bottom: var(--ct-spacing-md);
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

.loading-state, .error-state {
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

.unauthorized-container {
  padding: var(--ct-spacing-md);
  max-width: 600px;
  margin: var(--ct-spacing-xl) auto 0;
}

.denied-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ct-spacing-md) 0;
  text-align: center;
}

.unauthorized-text {
  color: var(--ct-color-text-secondary);
  font-family: var(--ct-font-body);
  font-size: 15px;
  line-height: 1.6;
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
