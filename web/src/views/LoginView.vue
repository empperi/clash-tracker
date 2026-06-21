<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth, functions } from '../firebase';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import BasePanel from '../components/BasePanel.vue';
import BaseButton from '../components/BaseButton.vue';

const router = useRouter();

const usernameOrEmail = ref('');
const status = ref<'idle' | 'loading' | 'sent' | 'error' | 'verifying' | 'success'>('idle');
const errorMessage = ref('');
const needsEmailConfirmation = ref(false);
const verificationCode = ref('');

async function handleVerifyOtp() {
  // To be implemented in Task 2
}

onMounted(async () => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    status.value = 'verifying';
    const email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      needsEmailConfirmation.value = true;
      status.value = 'idle';
      usernameOrEmail.value = '';
      return;
    }
    await completeSignIn(email);
  }
});

async function completeSignIn(email: string) {
  status.value = 'verifying';
  errorMessage.value = '';
  try {
    const userCredential = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem('emailForSignIn');

    // Exchange ID Token for session cookie
    const idToken = await userCredential.user.getIdToken();
    const response = await fetch('/api/sessionLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    status.value = 'success';
    setTimeout(() => {
      router.push('/');
    }, 1500);
  } catch (err: unknown) {
    status.value = 'error';
    errorMessage.value =
      err instanceof Error
        ? err.message
        : 'Verification failed. The link may have expired or already been used.';
  }
}

function backToLogin() {
  needsEmailConfirmation.value = false;
  status.value = 'idle';
  errorMessage.value = '';
  usernameOrEmail.value = '';
  // Drop the magic-link params so a refresh doesn't drop the user back into this step.
  router.replace({ path: '/login', query: {} });
}

async function handleSendLink() {
  if (!usernameOrEmail.value.trim()) {
    errorMessage.value = 'Please enter your username or email.';
    return;
  }

  status.value = 'loading';
  errorMessage.value = '';

  try {
    // Call findAccountForLogin callable (now generates and sends magic link server-side if account exists)
    const findAccount = httpsCallable<{ usernameOrEmail: string }, { status: string }>(
      functions,
      'findAccountForLogin'
    );
    await findAccount({ usernameOrEmail: usernameOrEmail.value });

    // If input was an email, save it locally to speed up completion flow on the same device.
    // If it was a username, we don't save it because we don't know the email (preserving non-enumeration).
    const trimmedInput = usernameOrEmail.value.trim();
    if (trimmedInput.includes('@')) {
      window.localStorage.setItem('emailForSignIn', trimmedInput.toLowerCase());
    } else {
      window.localStorage.removeItem('emailForSignIn');
    }

    status.value = 'sent';
  } catch (err: unknown) {
    status.value = 'error';
    errorMessage.value =
      err instanceof Error ? err.message : 'Failed to send login link. Please try again.';
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card-wrapper">
      <BasePanel title="ADMIN LOGIN">
        <div v-if="status === 'verifying'" class="status-container verifying">
          <div class="spinner"></div>
          <p class="status-msg">Verifying magic link...</p>
        </div>

        <div v-else-if="status === 'success'" class="status-container success">
          <div class="success-icon">✓</div>
          <h4 class="status-title">Successfully Signed In!</h4>
          <p class="status-msg">Redirecting to home page...</p>
        </div>

        <div v-else-if="needsEmailConfirmation" class="form-container confirm-step">
          <div class="confirm-header">
            <div class="confirm-icon">🔑</div>
            <h4 class="status-title">One last step</h4>
          </div>
          <p class="confirm-callout">
            Your sign-in link is valid. Enter your account email to finish signing in.
          </p>
          <div class="input-group">
            <label for="confirm-email">Email Address</label>
            <input
              id="confirm-email"
              v-model="usernameOrEmail"
              type="email"
              placeholder="e.g. chief@example.com"
              class="ct-input"
              @keyup.enter="completeSignIn(usernameOrEmail)"
            />
          </div>
          <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>
          <div class="confirm-actions">
            <BaseButton
              variant="primary"
              :disabled="status === 'loading'"
              @click="completeSignIn(usernameOrEmail)"
            >
              Confirm and Sign In
            </BaseButton>
            <BaseButton variant="secondary" @click="backToLogin"> ← Back to login </BaseButton>
          </div>
        </div>

        <div v-else-if="status === 'sent'" class="form-container sent-step">
          <div class="sent-header">
            <div class="sent-icon">✉</div>
            <h4 class="status-title">Check your email</h4>
          </div>
          <p class="sent-callout">
            We've sent a 6-digit verification code and a sign-in link to your registered email address.
          </p>

          <div class="input-group">
            <label for="otp-input">6-Digit Code</label>
            <input
              id="otp-input"
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              placeholder="e.g. 123456"
              class="ct-input otp-input"
              :disabled="status === 'loading'"
              @keyup.enter="handleVerifyOtp"
            />
          </div>

          <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>

          <div class="sent-actions">
            <BaseButton
              variant="primary"
              :disabled="status === 'loading' || verificationCode.length !== 6"
              @click="handleVerifyOtp"
            >
              {{ status === 'loading' ? 'Verifying...' : 'Verify & Sign In' }}
            </BaseButton>

            <p class="helper-text">
              Or, tap the auto-login button in your email to sign in directly.
            </p>

            <BaseButton
              variant="secondary"
              @click="
                status = 'idle';
                needsEmailConfirmation = false;
                errorMessage = '';
                verificationCode = '';
              "
            >
              ← Back to Sign In
            </BaseButton>
          </div>
        </div>

        <div v-else class="form-container">
          <p class="intro-text">
            Enter your username or email address below. We'll send a passwordless magic sign-in link
            to your registered email.
          </p>

          <div class="input-group">
            <label for="login-input">Username or Email</label>
            <input
              id="login-input"
              v-model="usernameOrEmail"
              type="text"
              placeholder="e.g. chief_barbarian"
              class="ct-input"
              :disabled="status === 'loading'"
              @keyup.enter="handleSendLink"
            />
          </div>

          <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>

          <div class="actions">
            <BaseButton variant="primary" :disabled="status === 'loading'" @click="handleSendLink">
              {{ status === 'loading' ? 'Sending...' : 'Send Magic Link' }}
            </BaseButton>
          </div>
        </div>
      </BasePanel>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
  padding: var(--ct-spacing-md);
}

.login-card-wrapper {
  width: 100%;
  max-width: 420px;
}

.intro-text {
  color: var(--ct-color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: var(--ct-spacing-lg);
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

.ct-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  background-color: var(--ct-color-red-light);
  border: 1px solid var(--ct-color-red);
  color: #ff8080;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  border-radius: var(--ct-radius-md);
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: var(--ct-spacing-lg);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--ct-spacing-lg) 0;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--ct-color-border);
  border-top-color: var(--ct-color-gold);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--ct-spacing-md);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-icon {
  font-size: 48px;
  color: var(--ct-color-green);
  margin-bottom: var(--ct-spacing-md);
  line-height: 1;
}

.sent-icon {
  font-size: 48px;
  color: var(--ct-color-gold);
  margin-bottom: var(--ct-spacing-md);
  line-height: 1;
}

/* Email-confirmation step: a distinct "status screen" header so users immediately
   recognise it is a different part of the flow, not the initial login form. */
.confirm-header {
  text-align: center;
  margin-bottom: var(--ct-spacing-md);
}

.confirm-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: var(--ct-spacing-sm);
}

.confirm-callout {
  background-color: var(--ct-color-surface-well);
  border-left: 4px solid var(--ct-color-gold);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-secondary);
  font-size: 15px;
  line-height: 1.5;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  margin-bottom: var(--ct-spacing-lg);
}

.confirm-actions {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-sm);
}

.status-title {
  font-size: 20px;
  margin-bottom: var(--ct-spacing-sm);
}

.status-msg {
  color: var(--ct-color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
  max-width: 320px;
  margin-bottom: var(--ct-spacing-lg);
}

.sent-header {
  text-align: center;
  margin-bottom: var(--ct-spacing-md);
}

.sent-callout {
  background-color: var(--ct-color-surface-well);
  border-left: 4px solid var(--ct-color-gold);
  border-radius: var(--ct-radius-md);
  color: var(--ct-color-text-secondary);
  font-size: 15px;
  line-height: 1.5;
  padding: var(--ct-spacing-sm) var(--ct-spacing-md);
  margin-bottom: var(--ct-spacing-lg);
}

.sent-actions {
  display: flex;
  flex-direction: column;
  gap: var(--ct-spacing-sm);
}

.otp-input {
  font-size: 24px;
  letter-spacing: 0.25em;
  text-align: center;
  font-family: monospace;
}

.helper-text {
  color: var(--ct-color-text-secondary);
  font-size: 14px;
  text-align: center;
  margin: var(--ct-spacing-xs) 0;
  line-height: 1.4;
}
</style>
