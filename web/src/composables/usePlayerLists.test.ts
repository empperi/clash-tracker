import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import type { Player, ClanRole } from '@clash-tracker/core';
import { usePlayerLists } from './usePlayerLists';
import type { Thresholds } from '../api/players';

function mk(tag: string, wars: number, usage: number, over: Partial<Player> = {}): Player {
  return {
    tag,
    name: tag.replace('#', ''),
    role: 'member' as ClanRole,
    thLevel: 15,
    inClan: true,
    stats: {
      warsParticipated: wars,
      attacksDone: 0,
      attacksAvailable: 0,
      attackUsagePct: usage,
      medianDestruction: 0,
      medianStars: 0,
      medianDefenses: 0,
      medianOwnDestruction: 0,
      lastWarParticipatedAt: null,
    },
    ...over,
  };
}

describe('usePlayerLists', () => {
  it('splits into above/below the line and not-enough-wars, each ranked', () => {
    const players = ref<readonly Player[]>([
      mk('#above1', 10, 90),
      mk('#below', 10, 50),
      mk('#above2', 10, 95),
      mk('#few', 2, 100),
    ]);
    const thresholds = ref<Thresholds>({ acceptancePct: 70, minWarParticipation: 5 });

    const { qualifiedAbove, qualifiedBelow, notEnoughWars } = usePlayerLists(players, thresholds);

    // above the line, ranked by usage desc
    expect(qualifiedAbove.value.map((p) => p.tag)).toEqual(['#above2', '#above1']);
    expect(qualifiedBelow.value.map((p) => p.tag)).toEqual(['#below']);
    // 2 wars < min 5 -> not enough, even at 100% usage
    expect(notEnoughWars.value.map((p) => p.tag)).toEqual(['#few']);
  });

  it('re-splits reactively when the thresholds change', () => {
    const players = ref<readonly Player[]>([mk('#p', 10, 80)]);
    const thresholds = ref<Thresholds>({ acceptancePct: 70, minWarParticipation: 5 });

    const { qualifiedAbove, qualifiedBelow } = usePlayerLists(players, thresholds);
    expect(qualifiedAbove.value.map((p) => p.tag)).toEqual(['#p']);
    expect(qualifiedBelow.value).toEqual([]);

    // Raise the acceptance level above the player's 80% -> they drop below the line.
    thresholds.value = { acceptancePct: 90, minWarParticipation: 5 };
    expect(qualifiedAbove.value).toEqual([]);
    expect(qualifiedBelow.value.map((p) => p.tag)).toEqual(['#p']);
  });

  it('treats exactly-equal boundary values as qualified / above (>=)', () => {
    const players = ref<readonly Player[]>([mk('#edge', 5, 70)]);
    const thresholds = ref<Thresholds>({ acceptancePct: 70, minWarParticipation: 5 });
    const { qualifiedAbove, notEnoughWars } = usePlayerLists(players, thresholds);
    expect(qualifiedAbove.value.map((p) => p.tag)).toEqual(['#edge']);
    expect(notEnoughWars.value).toEqual([]);
  });

  it('returns empty groups for no players', () => {
    const { qualifiedAbove, qualifiedBelow, notEnoughWars } = usePlayerLists(
      ref<readonly Player[]>([]),
      ref<Thresholds>({ acceptancePct: 50, minWarParticipation: 3 })
    );
    expect(qualifiedAbove.value).toEqual([]);
    expect(qualifiedBelow.value).toEqual([]);
    expect(notEnoughWars.value).toEqual([]);
  });
});
