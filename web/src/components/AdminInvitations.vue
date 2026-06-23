<script setup lang="ts">
import { ref, inject, computed } from 'vue';
import { useSession } from '../composables/useSession';
import { INVITATIONS_API, EMPTY_INVITATIONS_API } from '../api/invitations';
import { useInvitations } from '../composables/useInvitations';
import { validateEmail } from '@clash-tracker/core';
import BasePanel from './BasePanel.vue';
import BaseButton from './BaseButton.vue';
import ListRow from './ListRow.vue';

const { capabilities } = useSession();
const canInvite = computed(() => capabilities.value.canInviteAdmins);

const invitationsApi = inject(INVITATIONS_API, EMPTY_INVITATIONS_API);
const {
  invitations,
  isLoading,
  isError,
  isInviting,
  invite,
  revoke,
} = useInvitations(invitationsApi);

const emailInput = ref('');
const validationError = ref('');
const submitError = ref('');
const submitSuccess = ref(false);

async function onSubmit() {
  validationError.value = '';
  submitError.value = '';
  submitSuccess.value = false;

  const result = validateEmail(emailInput.value);
  if (!result.success) {
    validationError.value = result.error || 'Invalid email address';
    return;
  }

  try {
    await invite(result.value);
    emailInput.value = '';
    submitSuccess.value = true;
    setTimeout(() => {
      submitSuccess.value = false;
    }, 3000);
  } catch (err: unknown) {
    submitError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onRevoke(id: string) {
  try {
    await revoke(id);
  } catch (err: unknown) {
    console.error('Failed to revoke invite:', err);
  }
}
</script>

<template>
  <div v-if="canInvite" class="ct-invitations-panel">
    <BasePanel title="Admin Invitations">
      <!-- Invite Form -->
      <form class="invite-form" @submit.prevent="onSubmit">
        <div class="form-group">
          <label for="invite-email" class="form-label">Email Address</label>
          <div class="input-row">
            <input
              id="invite-email"
              v-model="emailInput"
              type="email"
              placeholder="admin@example.com"
              class="ct-input"
              :disabled="isInviting"
              required
            />
            <BaseButton
              type="submit"
              variant="primary"
              :disabled="isInviting"
            >
              {{ isInviting ? 'SENDING...' : 'SEND INVITE' }}
            </BaseButton>
          </div>
          <p v-if="validationError" class="validation-error">{{ validationError }}</p>
          <p v-if="submitError" class="submit-error">{{ submitError }}</p>
          <p v-if="submitSuccess" class="submit-success">Invitation sent successfully!</p>
        </div>
      </form>

      <!-- Pending Invitations List -->
      <div class="pending-section">
        <h4 class="section-title">Pending Invitations</h4>
        <div v-if="isLoading" class="loading-state">Loading invitations...</div>
        <div v-else-if="isError" class="error-state">Failed to load invitations.</div>
        <div v-else-if="invitations.length === 0" class="empty-state">No pending invitations.</div>
        <div v-else class="invites-list">
          <ListRow
            v-for="inv in invitations"
            :key="inv.id"
            class="invite-row"
          >
            <div class="invite-info">
              <span class="invite-email">{{ inv.email }}</span>
              <span v-if="inv.expired" class="badge badge-expired">EXPIRED</span>
            </div>
            <BaseButton
              variant="danger"
              class="btn-revoke"
              :disabled="isInviting"
              @click="onRevoke(inv.id)"
            >
              REVOKE
            </BaseButton>
          </ListRow>
        </div>
      </div>
    </BasePanel>
  </div>
</template>

<style scoped>
.invite-form {
  margin-bottom: var(--ct-spacing-lg);
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

.input-row {
  display: flex;
  gap: var(--ct-spacing-sm);
}

.ct-input {
  flex: 1;
  min-height: 44px;
  padding: 0 var(--ct-spacing-md);
  font-family: var(--ct-font-body);
  font-size: 15px;
  background: var(--ct-color-surface-well);
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-primary);
  outline: none;
  transition: border-color 0.15s ease;
}

.ct-input:focus {
  border-color: var(--ct-color-gold);
}

.ct-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.validation-error, .submit-error {
  font-size: 13px;
  color: #f44336;
  margin: var(--ct-spacing-xs) 0 0 0;
  font-weight: 600;
}

.submit-success {
  font-size: 13px;
  color: #4caf50;
  margin: var(--ct-spacing-xs) 0 0 0;
  font-weight: 600;
}

.pending-section {
  border-top: 1px solid var(--ct-color-border);
  padding-top: var(--ct-spacing-md);
}

.section-title {
  margin: 0 0 var(--ct-spacing-sm) 0;
  font-family: var(--ct-font-display);
  font-size: 16px;
  color: var(--ct-color-gold-text);
}

.loading-state, .error-state, .empty-state {
  font-family: var(--ct-font-body);
  font-size: 14px;
  color: var(--ct-color-text-secondary);
  text-align: center;
  padding: var(--ct-spacing-lg) 0;
}

.error-state {
  color: #f44336;
}

.invite-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--ct-spacing-md);
  width: 100%;
}

.invite-info {
  display: flex;
  align-items: center;
  gap: var(--ct-spacing-sm);
  flex: 1;
  min-width: 0;
}

.invite-email {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: var(--ct-radius-sm);
  letter-spacing: 0.05em;
}

.badge-expired {
  background-color: #8c0d0d;
  border: 1px solid #ff7373;
  color: #ffffff;
}

.btn-revoke {
  flex-shrink: 0;
  font-size: 13px;
  padding: 0 var(--ct-spacing-md);
  min-height: 36px !important; /* Smaller but still usable, parent has min-height 44px for the row */
}
</style>
