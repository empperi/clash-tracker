import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BaseButton from './BaseButton.vue';

test('renders slot content', () => {
  const wrapper = mount(BaseButton, {
    slots: {
      default: 'Click me',
    },
  });
  expect(wrapper.text()).toContain('Click me');
});

test('applies variant classes', () => {
  const wrapper = mount(BaseButton, {
    props: {
      variant: 'danger',
    },
  });
  expect(wrapper.classes()).toContain('ct-btn-danger');
});

test('has >=44px touch target (assert min-height style)', () => {
  const wrapper = mount(BaseButton);
  const style = window.getComputedStyle(wrapper.element);
  expect(style.minHeight).toBe('44px');
});

test('handles disabled state', () => {
  const wrapper = mount(BaseButton, {
    props: {
      disabled: true,
    },
  });
  expect(wrapper.attributes('disabled')).toBeDefined();
  expect(wrapper.classes()).toContain('ct-btn-disabled');
});
