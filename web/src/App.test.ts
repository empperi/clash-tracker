import { mount, flushPromises } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';
import App from './App.vue';
import { createPinia } from 'pinia';
import router from './router';
import { VueQueryPlugin } from '@tanstack/vue-query';

async function mountApp() {
  const pinia = createPinia();
  router.push('/');
  await router.isReady();
  return mount(App, { global: { plugins: [pinia, router, VueQueryPlugin] } });
}

test('App mounts and renders AppHeader', async () => {
  const wrapper = await mountApp();
  expect(wrapper.find('header').exists()).toBe(true);
});

test('App renders a 3-panel swipe carousel centred at rest', async () => {
  const wrapper = await mountApp();
  const track = wrapper.find('.swipe-track');
  expect(track.exists()).toBe(true);
  // prev + active + next panels are all rendered for the carousel.
  expect(wrapper.findAll('.swipe-panel')).toHaveLength(3);
  // At rest the track centres the active (middle) panel with no drag offset.
  expect(track.attributes('style')).toContain('translateX(calc(-100% + 0px))');
});

test('App shows the active view and its wrapped neighbours', async () => {
  const wrapper = await mountApp();
  // From player-list: prev wraps to Owner, active is Players, next is War Plan.
  const text = wrapper.text();
  expect(text).toContain('Player List');
  expect(text).toContain('War Plan');
  expect(text).toContain('Owner');
});

test('navigating the router (nav tap / deep link) recentres the carousel', async () => {
  const wrapper = await mountApp();
  await router.push('/admin');
  await wrapper.vm.$nextTick();
  // The route watcher should recentre on Admin without throwing.
  const track = wrapper.find('.swipe-track');
  expect(track.attributes('style')).toContain('translateX(calc(-100% + 0px))');
});

test('App renders RegisterView when route is /register', async () => {
  // Mock fetch status call for the guard in RegisterView to not redirect to /
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ exists: true, expired: false, email: 'invited@example.com' }),
  });
  vi.stubGlobal('fetch', fetchMock);

  const pinia = createPinia();
  router.push('/register?inviteId=test-invite-id');
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router, VueQueryPlugin],
    },
  });

  // Let the guard resolve status fetch
  await flushPromises();

  expect(wrapper.find('header').exists()).toBe(true);
  expect(wrapper.find('.swipe-track').exists()).toBe(false);
  expect(wrapper.find('.login-container').exists()).toBe(true);
  expect(wrapper.find('form').exists()).toBe(true);
  expect(wrapper.text()).toContain('Activate Admin Account');
  expect(wrapper.text()).toContain('invited@example.com');
  expect(wrapper.find('#username-input').exists()).toBe(true);
  expect(wrapper.find('nav.app-nav').exists()).toBe(false); // Bottom navigation must be hidden
});
