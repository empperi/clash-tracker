import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { decideRegistrationStatus } from '@clash-tracker/core';

export function useRegistrationGuard(
  inviteId: string | null,
  fetchStatusFn: (id: string) => Promise<{ exists: boolean; expired?: boolean; email?: string }>
) {
  const router = useRouter();
  const status = ref<'loading' | 'show-form'>('loading');
  const email = ref<string | null>(null);

  onMounted(async () => {
    if (!inviteId) {
      router.push('/');
      return;
    }

    try {
      const data = await fetchStatusFn(inviteId);
      
      const inviteExists = data.exists;
      const now = new Date();
      const createdAt = data.exists
        ? (data.expired ? new Date(now.getTime() - 40 * 60 * 1000) : new Date(now.getTime() - 10 * 60 * 1000))
        : null;

      const decision = decideRegistrationStatus(inviteExists, createdAt, now);
      if (decision === 'redirect-invalid' || decision === 'redirect-expired') {
        router.push('/');
        return;
      }

      email.value = data.email || null;
      status.value = 'show-form';
    } catch (err: unknown) {
      console.error('Registration guard check failed:', err);
      router.push('/');
    }
  });

  return { status, email };
}
