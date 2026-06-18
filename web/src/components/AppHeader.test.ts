import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import AppHeader from './AppHeader.vue';

test('renders default clan name and the app icon as the default logo', () => {
  const wrapper = mount(AppHeader);
  expect(wrapper.text()).toContain('Clash Tracker');
  expect(wrapper.find('img').attributes('src')).toBe('/icons/icon-512x512.png');
});

test('renders custom clan name and custom logo', () => {
  const wrapper = mount(AppHeader, {
    props: {
      clanName: 'Elite Warriors',
      clanLogo: 'https://example.com/logo.png',
    },
  });
  expect(wrapper.text()).toContain('Elite Warriors');
  expect(wrapper.find('img').attributes('src')).toBe('https://example.com/logo.png');
});
