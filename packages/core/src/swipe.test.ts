import { describe, expect, it } from 'vitest';
import {
  resolveSwipe,
  swipeTransition,
  SWIPE_DISTANCE_RATIO,
  FLICK_MAX_DURATION_MS,
  FLICK_MIN_DISTANCE_PX,
  FLICK_MIN_VELOCITY_PX_PER_MS,
  SNAP_BACK_MS,
  MIN_ANIMATE_MS,
  SLOW_DRAG_MAX_ANIMATE_MS,
} from './swipe';

// Convention under test:
//   dx is the net horizontal displacement (finger end - start), in px.
//   dx < 0 (dragged left)  -> advance to 'next' view.
//   dx > 0 (dragged right) -> go to 'prev' view.
//   velocity is |dx| / durationMs in px/ms (always provided as a non-negative magnitude).

describe('resolveSwipe', () => {
  const viewWidth = 400; // 40% threshold = 160px

  it('stays put when there is no movement', () => {
    expect(resolveSwipe({ dx: 0, viewWidth, durationMs: 100, velocity: 0 })).toBe('stay');
  });

  it('guards against a non-positive viewWidth', () => {
    expect(resolveSwipe({ dx: -300, viewWidth: 0, durationMs: 600, velocity: 0.5 })).toBe('stay');
  });

  describe('slow drag (settles by distance)', () => {
    const durationMs = 600; // > FLICK_MAX_DURATION_MS, so not a flick

    it('advances to next when dragged left past 40% of the width', () => {
      expect(resolveSwipe({ dx: -200, viewWidth, durationMs, velocity: 0.33 })).toBe('next');
    });

    it('goes to prev when dragged right past 40% of the width', () => {
      expect(resolveSwipe({ dx: 200, viewWidth, durationMs, velocity: 0.33 })).toBe('prev');
    });

    it('stays put when dragged less than 40% of the width', () => {
      expect(resolveSwipe({ dx: -100, viewWidth, durationMs, velocity: 0.16 })).toBe('stay');
    });

    it('commits at exactly the 40% boundary (>=)', () => {
      const dx = -SWIPE_DISTANCE_RATIO * viewWidth; // -160
      expect(resolveSwipe({ dx, viewWidth, durationMs, velocity: 0.27 })).toBe('next');
    });
  });

  describe('flick (fast gesture)', () => {
    it('advances to next on a quick left flick over a small distance', () => {
      expect(resolveSwipe({ dx: -20, viewWidth, durationMs: 120, velocity: 0.5 })).toBe('next');
    });

    it('goes to prev on a quick right flick', () => {
      expect(resolveSwipe({ dx: 30, viewWidth, durationMs: 100, velocity: 0.4 })).toBe('prev');
    });

    it('commits at exactly the flick duration boundary (<=)', () => {
      expect(
        resolveSwipe({ dx: -20, viewWidth, durationMs: FLICK_MAX_DURATION_MS, velocity: 0.4 })
      ).toBe('next');
    });

    it('ignores tiny jitters below the minimum flick distance', () => {
      const dx = -(FLICK_MIN_DISTANCE_PX - 1);
      expect(resolveSwipe({ dx, viewWidth, durationMs: 100, velocity: 0.5 })).toBe('stay');
    });

    it('does not treat a fast but low-velocity drag as a flick', () => {
      // Fast in time but barely moved and short of the slow-drag distance threshold.
      const velocity = FLICK_MIN_VELOCITY_PX_PER_MS - 0.05;
      expect(resolveSwipe({ dx: -40, viewWidth, durationMs: 200, velocity })).toBe('stay');
    });
  });
});

describe('swipeTransition', () => {
  it('uses a fixed quick snap-back when no change is committed', () => {
    expect(swipeTransition({ change: false, durationMs: 50 }).animateMs).toBe(SNAP_BACK_MS);
    expect(swipeTransition({ change: false, durationMs: 5000 }).animateMs).toBe(SNAP_BACK_MS);
  });

  it('floors a very fast flick so it does not complete jarringly fast', () => {
    expect(swipeTransition({ change: true, durationMs: 40 }).animateMs).toBe(MIN_ANIMATE_MS);
  });

  it('completes a flick within 250ms', () => {
    for (const durationMs of [40, 120, 200, FLICK_MAX_DURATION_MS]) {
      const { animateMs } = swipeTransition({ change: true, durationMs });
      expect(animateMs).toBeLessThanOrEqual(FLICK_MAX_DURATION_MS);
      expect(animateMs).toBeGreaterThanOrEqual(MIN_ANIMATE_MS);
    }
  });

  it('passes through a flick duration between the floor and the cap', () => {
    expect(swipeTransition({ change: true, durationMs: 200 }).animateMs).toBe(200);
  });

  it('respects a slow drag pace beyond the flick threshold', () => {
    expect(swipeTransition({ change: true, durationMs: 300 }).animateMs).toBe(300);
  });

  it('caps a very slow drag', () => {
    expect(swipeTransition({ change: true, durationMs: 5000 }).animateMs).toBe(
      SLOW_DRAG_MAX_ANIMATE_MS
    );
  });
});
