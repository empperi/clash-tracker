import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import BasePanel from './BasePanel.vue';

test('renders title prop', () => {
  const wrapper = mount(BasePanel, {
    props: {
      title: 'Panel Title',
    },
  });
  expect(wrapper.find('.ct-panel-title').text()).toBe('Panel Title');
});

test('renders title slot override', () => {
  const wrapper = mount(BasePanel, {
    slots: {
      title: 'Slot Title',
    },
  });
  expect(wrapper.find('.ct-panel-title').text()).toBe('Slot Title');
});

test('renders default slot content', () => {
  const wrapper = mount(BasePanel, {
    slots: {
      default: '<p>Body Content</p>',
    },
  });
  expect(wrapper.find('.ct-panel-body').html()).toContain('Body Content');
});

test('renders footer slot content', () => {
  const wrapper = mount(BasePanel, {
    slots: {
      footer: '<p>Footer Content</p>',
    },
  });
  expect(wrapper.find('.ct-panel-footer').html()).toContain('Footer Content');
});
