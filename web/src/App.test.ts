import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import App from './App.vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import { VueQueryPlugin } from '@tanstack/vue-query';

test('App mounts and renders AppHeader', () => {
  const pinia = createPinia();
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/', component: { template: '<div>Home</div>' } }],
  });

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router, VueQueryPlugin],
    },
  });

  // This will fail on empty or placeholder App.vue that does not contain a <header> element
  expect(wrapper.find('header').exists()).toBe(true);
});
