import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import QualificationLine from './QualificationLine.vue';

describe('QualificationLine', () => {
  it('renders a labelled separator showing the acceptance threshold', () => {
    const wrapper = mount(QualificationLine, { props: { acceptancePct: 70 } });
    expect(wrapper.text()).toContain('70%');
    expect(wrapper.attributes('role')).toBe('separator');
  });

  it('conveys meaning beyond color via an icon and a text label', () => {
    const wrapper = mount(QualificationLine, { props: { acceptancePct: 80 } });
    expect(wrapper.find('.line-icon').exists()).toBe(true);
    expect(wrapper.find('.line-label').text().length).toBeGreaterThan(0);
    expect(wrapper.attributes('aria-label')).toContain('80');
  });
});
