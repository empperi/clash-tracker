import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { isSignInWithEmailLink } from 'firebase/auth';
import LoginView from './LoginView.vue';

// Mock Router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'player-list', component: { template: '<div>Home</div>' } },
    { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
  ],
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock fetch
const fetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ status: 'success' }),
});
vi.stubGlobal('fetch', fetchMock);

// Mock firebase
const mockSignInWithLink = vi.fn().mockResolvedValue({
  user: {
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  },
});

const mockSignInWithCustomToken = vi.fn().mockResolvedValue({
  user: {
    getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
  },
});

vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(),
    isSignInWithEmailLink: vi.fn().mockReturnValue(false),
    signInWithEmailLink: (...args: unknown[]) => mockSignInWithLink(...args),
    signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
  };
});

const mockFindAccount = vi.fn().mockResolvedValue({
  data: { status: 'ok' },
});

const mockVerifyOtp = vi.fn().mockResolvedValue({
  data: { customToken: 'mock-custom-token' },
});

vi.mock('firebase/functions', () => {
  return {
    getFunctions: vi.fn(),
    httpsCallable: vi.fn((_, name) => {
      if (name === 'verifyLoginOtp') {
        return mockVerifyOtp;
      }
      return mockFindAccount;
    }),
  };
});

vi.mock('../firebase', () => {
  return {
    auth: {},
    functions: {},
  };
});

describe('LoginView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    });
    expect(wrapper.text()).toContain('Username or Email');
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
  });

  it('submitting send link calls findAccountForLogin and shows sent status', async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    });

    const input = wrapper.find('input[type="text"]');
    await input.setValue('john_doe');

    const button = wrapper.find('button');
    await button.trigger('click');
    await flushPromises();

    expect(mockFindAccount).toHaveBeenCalledWith({ usernameOrEmail: 'john_doe' });
    expect(wrapper.text()).toContain('Check your email');
    expect(wrapper.find('input.otp-input').exists()).toBe(true);
  });

  it('shows a visually distinct email-confirmation step, not a clone of the login form', async () => {
    // Arrive via a magic link, but with no email stored locally (e.g. signed in with a
    // username, or opened the link on another device).
    localStorageMock.clear();
    vi.mocked(isSignInWithEmailLink).mockReturnValueOnce(true);

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    const text = wrapper.text();
    // Distinct heading + callout make it obvious this is a different step.
    expect(text).toContain('One last step');
    expect(text).toContain('Email Address');
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    // A way back out of the step.
    expect(text).toContain('Back to login');
    // Crucially, it must NOT look like the initial username/email entry form.
    expect(text).not.toContain('Username or Email');
  });

  it('submitting correct 6-digit OTP code logs in user and redirects to home page', async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    });

    // 1. Move to sent/otp screen
    const input = wrapper.find('input[type="text"]');
    await input.setValue('john_doe');
    const button = wrapper.find('button');
    await button.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Check your email');

    // 2. Fill 6-digit code
    const otpInput = wrapper.find('input.otp-input');
    await otpInput.setValue('123456');

    // 3. Trigger submit
    const verifyButton = wrapper.find('.sent-step button.ct-btn-primary');
    await verifyButton.trigger('click');
    await flushPromises();

    expect(mockVerifyOtp).toHaveBeenCalledWith({ usernameOrEmail: 'john_doe', code: '123456' });
    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'mock-custom-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/sessionLogin', expect.anything());

    // Status should be success
    expect(wrapper.text()).toContain('Successfully Signed In!');
  });

  it('submitting incorrect 6-digit OTP code shows uniform error and clears input', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Invalid code'));

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router],
      },
    });

    // 1. Move to sent/otp screen
    const input = wrapper.find('input[type="text"]');
    await input.setValue('john_doe');
    const button = wrapper.find('button');
    await button.trigger('click');
    await flushPromises();

    // 2. Fill 6-digit code
    const otpInput = wrapper.find('input.otp-input');
    await otpInput.setValue('000000');

    // 3. Trigger submit
    const verifyButton = wrapper.find('.sent-step button.ct-btn-primary');
    await verifyButton.trigger('click');
    await flushPromises();

    // Status remains sent with error
    expect(wrapper.text()).toContain('Check your email');
    expect(wrapper.text()).toContain('Invalid or expired code.');
    expect((wrapper.find('input.otp-input').element as HTMLInputElement).value).toBe('');
  });
});
