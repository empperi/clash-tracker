import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

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

      if (!data.exists || data.expired) {
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
