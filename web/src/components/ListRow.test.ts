import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import ListRow from './ListRow.vue';

test('renders default slot content', () => {
  const wrapper = mount(ListRow, {
    slots: {
      default: 'Row content',
    },
  });
  expect(wrapper.text()).toContain('Row content');
});

test('applies clickable class when clickable prop is true', () => {
  const wrapper = mount(ListRow, {
    props: {
      clickable: true,
    },
  });
  expect(wrapper.classes()).toContain('ct-row-clickable');
});

test('applies active class when active prop is true', () => {
  const wrapper = mount(ListRow, {
    props: {
      active: true,
    },
  });
  expect(wrapper.classes()).toContain('ct-row-active');
});

test('has >=44px touch target (assert min-height style)', () => {
  const wrapper = mount(ListRow);
  const style = window.getComputedStyle(wrapper.element);
  expect(style.minHeight).toBe('44px');
});
