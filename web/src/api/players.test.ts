import { describe, it, expect } from 'vitest';
import { playerFromDoc, thresholdsFromDoc, DEFAULT_THRESHOLDS } from './players';

describe('playerFromDoc', () => {
  it('decodes the flat player document into a core Player', () => {
    const player = playerFromDoc({
      tag: '#A',
      name: 'Alpha',
      role: 'leader',
      thLevel: 16,
      inClan: true,
      warsParticipated: 5,
      attacksDone: 8,
      attacksAvailable: 10,
      attackUsagePct: 80,
      medianDestruction: 90,
      medianStars: 2,
      medianDefenses: 1,
      medianOwnDestruction: 50,
      lastWarParticipatedAt: '2026-06-10T10:00:00.000Z',
    });

    expect(player).toEqual({
      tag: '#A',
      name: 'Alpha',
      role: 'leader',
      thLevel: 16,
      inClan: true,
      stats: {
        warsParticipated: 5,
        attacksDone: 8,
        attacksAvailable: 10,
        attackUsagePct: 80,
        medianDestruction: 90,
        medianStars: 2,
        medianDefenses: 1,
        medianOwnDestruction: 50,
        lastWarParticipatedAt: '2026-06-10T10:00:00.000Z',
      },
    });
  });

  it('fills missing fields with safe defaults', () => {
    const player = playerFromDoc({ tag: '#B' });
    expect(player.name).toBe('');
    expect(player.role).toBe('member');
    expect(player.inClan).toBe(false);
    expect(player.stats.warsParticipated).toBe(0);
    expect(player.stats.lastWarParticipatedAt).toBeNull();
  });
});

describe('thresholdsFromDoc', () => {
  it('reads thresholds from the config document', () => {
    expect(thresholdsFromDoc({ acceptancePct: 70, minWarParticipation: 5 })).toEqual({
      acceptancePct: 70,
      minWarParticipation: 5,
    });
  });

  it('falls back to neutral defaults when the doc is missing', () => {
    expect(thresholdsFromDoc(undefined)).toEqual(DEFAULT_THRESHOLDS);
  });

  it('fills only the missing threshold fields', () => {
    expect(thresholdsFromDoc({ acceptancePct: 60 })).toEqual({
      acceptancePct: 60,
      minWarParticipation: DEFAULT_THRESHOLDS.minWarParticipation,
    });
  });
});
