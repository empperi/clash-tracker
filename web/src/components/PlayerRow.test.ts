import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import PlayerRow from './PlayerRow.vue';
import type { Player } from '@clash-tracker/core';

const player: Player = {
  tag: '#ABC',
  name: 'WarMachine',
  role: 'coLeader',
  thLevel: 16,
  inClan: true,
  stats: {
    warsParticipated: 12,
    attacksDone: 20,
    attacksAvailable: 24,
    attackUsagePct: 83,
    medianDestruction: 95,
    medianStars: 3,
    medianDefenses: 2,
    medianOwnDestruction: 47,
    lastWarParticipatedAt: '2026-06-12T10:00:00.000Z',
  },
};

describe('PlayerRow', () => {
  it('renders as a semantic list item', () => {
    const wrapper = mount(PlayerRow, { props: { player } });
    expect(wrapper.element.tagName).toBe('LI');
  });

  it('renders the primary stats: name, role, TH and attack-usage %', () => {
    const wrapper = mount(PlayerRow, { props: { player } });
    const text = wrapper.text();
    expect(text).toContain('WarMachine');
    expect(text).toContain('Co-Leader'); // role in game terms
    expect(text).toContain('TH16');
    expect(text).toContain('83%');
    expect(text).toContain('12'); // wars participated
  });

  it('renders every secondary stat in the DOM', () => {
    const wrapper = mount(PlayerRow, { props: { player } });
    const text = wrapper.text();
    expect(text).toContain('20'); // attacks done
    expect(text).toContain('24'); // attacks available
    expect(text).toContain('3'); // median stars
    expect(text).toContain('95'); // median destruction
    expect(text).toContain('2'); // median defenses
    expect(text).toContain('47'); // median own destruction
  });

  it('has a touch target of at least 44px on the interactive row', () => {
    const wrapper = mount(PlayerRow, { props: { player } });
    const main = wrapper.find('.row-main');
    expect(window.getComputedStyle(main.element).minHeight).toBe('44px');
  });

  it('shows a non-color-only qualified indicator (icon + label) only when qualified', () => {
    const plain = mount(PlayerRow, { props: { player } });
    expect(plain.text()).not.toContain('above the line');

    const qualified = mount(PlayerRow, { props: { player, qualified: true } });
    expect(qualified.find('.qualified-badge').exists()).toBe(true);
    expect(qualified.text()).toContain('above the line'); // visually-hidden label
  });
});
