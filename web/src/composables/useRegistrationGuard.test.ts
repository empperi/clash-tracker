import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { useRegistrationGuard } from './useRegistrationGuard';

// Define a test router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'player-list', component: { template: '<div>Home</div>' } },
    { path: '/register', name: 'register', component: { template: '<div>Register</div>' } },
  ],
});

function withUseRegistrationGuard(
  inviteId: string | null,
  fetchStatusFn: (id: string) => Promise<{ exists: boolean; expired?: boolean; email?: string }>
) {
  let result!: ReturnType<typeof useRegistrationGuard>;
  const Comp = defineComponent({
    setup() {
      result = useRegistrationGuard(inviteId, fetchStatusFn);
      return () => h('div');
    },
  });
  const wrapper = mount(Comp, {
    global: {
      plugins: [router],
    },
  });
  return { result: () => result, wrapper };
}

describe('useRegistrationGuard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await router.push('/register');
  });

  it("redirects to '/' when inviteId is null", async () => {
    const fetchStatusFn = vi.fn();
    const { result } = withUseRegistrationGuard(null, fetchStatusFn);

    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/');
    expect(fetchStatusFn).not.toHaveBeenCalled();
    expect(result().status.value).toBe('loading');
  });

  it("redirects to '/' and stays loading when invitation does not exist", async () => {
    const fetchStatusFn = vi.fn().mockResolvedValue({ exists: false });
    const { result } = withUseRegistrationGuard('invalid-id', fetchStatusFn);

    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/');
    expect(fetchStatusFn).toHaveBeenCalledWith('invalid-id');
    expect(result().status.value).toBe('loading');
  });

  it("redirects to '/' when invitation is expired", async () => {
    const fetchStatusFn = vi
      .fn()
      .mockResolvedValue({ exists: true, expired: true, email: 'test@example.com' });
    const { result } = withUseRegistrationGuard('expired-id', fetchStatusFn);

    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/');
    expect(fetchStatusFn).toHaveBeenCalledWith('expired-id');
    expect(result().status.value).toBe('loading');
  });

  it('shows form and exposes email when invitation is valid', async () => {
    const fetchStatusFn = vi
      .fn()
      .mockResolvedValue({ exists: true, expired: false, email: 'admin@example.com' });
    const { result } = withUseRegistrationGuard('valid-id', fetchStatusFn);

    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/register');
    expect(fetchStatusFn).toHaveBeenCalledWith('valid-id');
    expect(result().status.value).toBe('show-form');
    expect(result().email.value).toBe('admin@example.com');
  });
});
