import { mount } from '@vue/test-utils';
import { expect, test, vi, beforeEach, describe } from 'vitest';
import { ref } from 'vue';
import AppHeader from './AppHeader.vue';
import { createRouter, createWebHistory } from 'vue-router';

// Mock Router
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/login', component: { template: '<div>Login</div>' } }],
});

const mockUseSession = vi.fn();
vi.mock('../composables/useSession', () => ({
  useSession: () => mockUseSession(),
}));

describe('AppHeader.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders default clan name and the app icon as the default logo', () => {
    mockUseSession.mockReturnValue({
      user: ref(null),
      loading: ref(false),
      logout: vi.fn(),
    });

    const wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
      },
    });
    expect(wrapper.text()).toContain('Clash Tracker');
    expect(wrapper.find('img').attributes('src')).toBe('/icons/icon-512x512.png');
  });

  test('renders custom clan name and custom logo', () => {
    mockUseSession.mockReturnValue({
      user: ref(null),
      loading: ref(false),
      logout: vi.fn(),
    });

    const wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
      },
      props: {
        clanName: 'Elite Warriors',
        clanLogo: 'https://example.com/logo.png',
      },
    });
    expect(wrapper.text()).toContain('Elite Warriors');
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/logo.png');
  });

  test('renders login link when logged out', () => {
    mockUseSession.mockReturnValue({
      user: ref(null),
      loading: ref(false),
      logout: vi.fn(),
    });

    const wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
      },
    });

    const loginLink = wrapper.find('.login-link');
    expect(loginLink.exists()).toBe(true);
    expect(loginLink.text()).toBe('Login');
  });

  test('renders username and logout button when logged in', () => {
    mockUseSession.mockReturnValue({
      user: ref({ email: 'admin@example.com', displayName: 'Chief Barbarian' }),
      loading: ref(false),
      logout: vi.fn(),
    });

    const wrapper = mount(AppHeader, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.login-link').exists()).toBe(false);
    expect(wrapper.find('.username').text()).toBe('Chief Barbarian');
    expect(wrapper.find('.logout-btn').exists()).toBe(true);
  });
});
