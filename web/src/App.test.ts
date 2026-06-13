import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import App from './App.vue';
import { createPinia } from 'pinia';
import router from './router';
import { VueQueryPlugin } from '@tanstack/vue-query';

test('App mounts and renders AppHeader', async () => {
  const pinia = createPinia();
  router.push('/');
  await router.isReady();

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router, VueQueryPlugin],
    },
  });

  expect(wrapper.find('header').exists()).toBe(true);
});
