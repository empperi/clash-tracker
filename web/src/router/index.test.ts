import { expect, test } from 'vitest';
import router from './index';

test('router matches routes and defaults to Player List', async () => {
  await router.push('/');
  expect(router.currentRoute.value.name).toBe('player-list');

  await router.push('/war-plan');
  expect(router.currentRoute.value.name).toBe('war-plan');

  await router.push('/admin');
  expect(router.currentRoute.value.name).toBe('admin');

  await router.push('/owner');
  expect(router.currentRoute.value.name).toBe('owner');
});
