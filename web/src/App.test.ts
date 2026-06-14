import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
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
