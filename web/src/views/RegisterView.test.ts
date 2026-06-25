import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import RegisterView from './RegisterView.vue';

// Mock Router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'player-list', component: { template: '<div>Home</div>' } },
    { path: '/register', name: 'register', component: { template: '<div>Register</div>' } },
  ],
});

// Mock fetch globally
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock firebase auth
const mockSignInWithCustomToken = vi.fn().mockResolvedValue({
  user: {
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  },
});

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(),
    signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
  };
});

vi.mock('../firebase', () => {
  return {
    auth: {},
  };
});

describe('RegisterView.vue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await router.push({ path: '/register', query: { inviteId: 'test-invite-id' } });
  });

  it('renders loading state initially', async () => {
    // Hang the fetch response to keep it in loading state
    fetchMock.mockReturnValue(new Promise(() => {}));

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain('Verifying invitation...');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('redirects to / if invitation is expired or not found', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: false }),
    });

    mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/');
  });

  it('renders form and displays email if invitation is valid', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true, expired: false, email: 'invited@example.com' }),
    });

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('invited@example.com');
    expect(wrapper.find('form').exists()).toBe(true);
    expect(wrapper.find('#username-input').exists()).toBe(true);
    expect(wrapper.find('#playertag-input').exists()).toBe(true);
  });

  it('shows client-side validation errors for empty username or invalid tag', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ exists: true, expired: false, email: 'invited@example.com' }),
    });

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    const form = wrapper.find('form');

    // Submit with empty username
    await form.trigger('submit.prevent');
    expect(wrapper.find('.error-msg').text()).toContain('Username cannot be empty.');

    // Set username, submit with invalid tag
    const usernameInput = wrapper.find('#username-input');
    await usernameInput.setValue('NewAdmin');
    const tagInput = wrapper.find('#playertag-input');
    await tagInput.setValue('invalid-tag');

    await form.trigger('submit.prevent');
    expect(wrapper.find('.error-msg').text()).toContain('Invalid player tag format.');
  });

  it('submits successfully, establishes session and redirects to home', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/api/getInviteStatus')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ exists: true, expired: false, email: 'invited@example.com' }),
        });
      }
      if (url.includes('/api/completeRegistration')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'success', customToken: 'token123' }),
        });
      }
      if (url.includes('/api/sessionLogin')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'success' }),
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    await wrapper.find('#username-input').setValue('NewAdmin');
    await wrapper.find('#playertag-input').setValue('#2PGQYPQ');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/completeRegistration',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          inviteId: 'test-invite-id',
          username: 'NewAdmin',
          playerTag: '#2PGQYPQ',
        }),
      })
    );

    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'token123');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sessionLogin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ idToken: 'mock-id-token' }),
      })
    );

    expect(router.currentRoute.value.path).toBe('/');
  });

  it('displays API errors if registration fails', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/api/getInviteStatus')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ exists: true, expired: false, email: 'invited@example.com' }),
        });
      }
      if (url.includes('/api/completeRegistration')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Username already taken or similar error',
        });
      }
      return Promise.reject(new Error('Unknown url: ' + url));
    });

    const wrapper = mount(RegisterView, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    await wrapper.find('#username-input').setValue('NewAdmin');
    await wrapper.find('#playertag-input').setValue('#2PGQYPQ');

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(wrapper.find('.error-msg').text()).toContain('Username already taken or similar error');
    expect(router.currentRoute.value.path).toBe('/register');
  });
});
