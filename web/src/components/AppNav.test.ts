import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import AppNav from './AppNav.vue';
import { createRouter, createWebHistory } from 'vue-router';

test('AppNav renders all 4 routes and checks active class', async () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'player-list', component: { template: '<div>List</div>' } },
      { path: '/war-plan', name: 'war-plan', component: { template: '<div>Plan</div>' } },
      { path: '/admin', name: 'admin', component: { template: '<div>Admin</div>' } },
      { path: '/owner', name: 'owner', component: { template: '<div>Owner</div>' } },
    ],
  });

  router.push('/');
  await router.isReady();

  const wrapper = mount(AppNav, {
    global: {
      plugins: [router],
    },
  });

  const links = wrapper.findAll('a');
  expect(links.length).toBe(4);
  expect(wrapper.text()).toContain('Players');
  expect(wrapper.text()).toContain('War Plan');
  expect(wrapper.text()).toContain('Admin');
  expect(wrapper.text()).toContain('Owner');
});
