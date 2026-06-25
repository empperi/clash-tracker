<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { auth } from '../firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { validatePlayerTag, normalizePlayerTag } from '@clash-tracker/core';
import { useRegistrationGuard } from '../composables/useRegistrationGuard';
import BasePanel from '../components/BasePanel.vue';
import BaseButton from '../components/BaseButton.vue';

const router = useRouter();
const route = useRoute();

const inviteId = (route.query.inviteId as string) || null;

async function fetchStatusFn(id: string) {
  const res = await fetch(`/api/getInviteStatus?inviteId=${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error('Failed to fetch invitation status');
  }
  return res.json();
}

const { status, email } = useRegistrationGuard(inviteId, fetchStatusFn);

const username = ref('');
const playerTag = ref('');
const errorMessage = ref('');
const submitting = ref(false);

async function handleSubmit() {
  if (submitting.value) return;

  const trimmedUsername = username.value.trim();
  if (!trimmedUsername) {
    errorMessage.value = 'Username cannot be empty.';
    return;
  }

  const normalizedTag = normalizePlayerTag(playerTag.value);
  if (!validatePlayerTag(normalizedTag)) {
    errorMessage.value =
      'Invalid player tag format. Must start with # and contain valid characters.';
    return;
  }

  errorMessage.value = '';
  submitting.value = true;

  try {
    const regRes = await fetch('/api/completeRegistration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteId,
        username: trimmedUsername,
        playerTag: normalizedTag,
      }),
    });

    if (!regRes.ok) {
      throw new Error(await regRes.text());
    }

    const data = await regRes.json();
    const customToken = data.customToken;

    // Log the user in
    const userCredential = await signInWithCustomToken(auth, customToken);
    const idToken = await userCredential.user.getIdToken();

    const sessionRes = await fetch('/api/sessionLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!sessionRes.ok) {
      throw new Error(await sessionRes.text());
    }

    router.push('/');
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
    submitting.value = false;
  }
}
</script>

<template>
  <div class="register-view">
    <div class="register-card-wrapper">
      <BasePanel title="Activate Admin Account">
        <div v-if="status === 'loading'" class="loading-state">
          <p>Verifying invitation...</p>
        </div>

        <div v-else class="form-container">
          <p class="intro-text">
            Complete your registration. You are completing registration for:
            <strong v-if="email" class="email-display">{{ email }}</strong>
          </p>

          <form @submit.prevent="handleSubmit">
            <div class="input-group">
              <label for="username-input">Username</label>
              <input
                id="username-input"
                v-model="username"
                type="text"
                placeholder="e.g. ChiefArcher"
                class="ct-input"
                :disabled="submitting"
                required
              />
            </div>

            <div class="input-group">
              <label for="playertag-input">Player Tag</label>
              <input
                id="playertag-input"
                v-model="playerTag"
                type="text"
                placeholder="e.g. #2PGQYPQ"
                class="ct-input"
                :disabled="submitting"
                required
              />
            </div>

            <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>

            <div class="actions">
              <BaseButton type="submit" variant="primary" :disabled="submitting">
                {{ submitting ? 'Saving...' : 'Complete Registration' }}
              </BaseButton>
            </div>
          </form>
        </div>
      </BasePanel>
    </div>
  </div>
</template>

<style scoped>
.register-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
  padding: var(--ct-spacing-md);
}

.register-card-wrapper {
  width: 100%;
  max-width: 420px;
}

.loading-state {
  text-align: center;
  color: var(--ct-color-text-secondary);
  padding: var(--ct-spacing-lg) 0;
}

.intro-text {
  color: var(--ct-color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: var(--ct-spacing-lg);
}

.email-display {
  display: block;
  margin-top: var(--ct-spacing-xs);
  color: var(--ct-color-gold-text);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-xs);
  margin-bottom: var(--ct-spacing-lg);
}

.input-group label {
  font-family: var(--ct-font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--ct-color-gold-text);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.ct-input {
  background-color: var(--ct-color-surface-well);
  border: 2px solid var(--ct-color-border);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-primary);
  font-family: var(--ct-font-body);
  font-size: 16px;
  padding: 12px var(--ct-spacing-md);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 48px; /* High accessibility touch target */
}

.ct-input:focus {
  outline: none;
  border-color: var(--ct-color-border-focus);
  box-shadow: var(--ct-focus-ring);
}

.error-msg {
  color: var(--ct-color-danger, #ef4444);
  font-size: 14px;
  margin-bottom: var(--ct-spacing-md);
  font-weight: 500;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-sm);
  margin-top: var(--ct-spacing-lg);
}
</style>
