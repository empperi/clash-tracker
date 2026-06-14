import { describe, expect, it } from 'vitest';
import { useSwipeNav, type UseSwipeNavOptions } from './useSwipeNav';

const ORDER = ['player-list', 'war-plan', 'admin', 'owner'] as const;

/** Build a composable with a controllable clock and a navigation spy. */
function setup(overrides: Partial<UseSwipeNavOptions> = {}) {
  let t = 0;
  const navigated: string[] = [];

  const nav = useSwipeNav({
    order: ORDER,
    initial: 'player-list',
    navigate: (view) => navigated.push(view),
    viewWidth: () => 400, // 40% threshold = 160px
    now: () => t,
    ...overrides,
  });

  return {
    nav,
    navigated,
    setClock: (ms: number) => {
      t = ms;
    },
  };
}

/** Drive a full gesture and the settle transition to completion. */
function swipe(
  nav: ReturnType<typeof setup>['nav'],
  dx: number,
  durationMs: number,
  setClock: (ms: number) => void
) {
  nav.onStart();
  nav.onMove(dx);
  setClock(durationMs);
  nav.onEnd();
  if (nav.isAnimating.value) nav.onTransitionEnd();
}

describe('useSwipeNav', () => {
  describe('adjacency wraps around', () => {
    it('reports wrapped prev/next from the first view', () => {
      const { nav } = setup();
      expect(nav.activeView.value).toBe('player-list');
      expect(nav.nextView.value).toBe('war-plan');
      expect(nav.prevView.value).toBe('owner'); // wraps to the last view
    });

    it('reports wrapped prev/next from the last view', () => {
      const { nav } = setup({ initial: 'owner' });
      expect(nav.nextView.value).toBe('player-list'); // wraps to the first view
      expect(nav.prevView.value).toBe('admin');
    });
  });

  describe('finger following', () => {
    it('follows the finger 1:1 during a drag', () => {
      const { nav } = setup();
      nav.onStart();
      nav.onMove(-50);
      expect(nav.isDragging.value).toBe(true);
      expect(nav.dragOffset.value).toBe(-50);
      nav.onMove(-120);
      expect(nav.dragOffset.value).toBe(-120);
    });

    it('ignores moves when no gesture is active', () => {
      const { nav } = setup();
      nav.onMove(-50);
      expect(nav.dragOffset.value).toBe(0);
    });
  });

  describe('committing a change slides then swaps (after the transition ends)', () => {
    it('does not change the active view until the settle transition ends', () => {
      const { nav, navigated, setClock } = setup();
      nav.onStart();
      nav.onMove(-30);
      setClock(120); // quick flick
      nav.onEnd();
      // Mid-animation: sliding toward the next panel, but not swapped yet.
      expect(nav.isAnimating.value).toBe(true);
      expect(nav.targetPercent.value).toBe(-200); // slide to centre the next panel
      expect(nav.activeView.value).toBe('player-list');
      expect(navigated).toEqual([]);

      nav.onTransitionEnd();
      expect(nav.activeView.value).toBe('war-plan');
      expect(navigated).toEqual(['war-plan']);
      expect(nav.isAnimating.value).toBe(false);
      expect(nav.dragOffset.value).toBe(0);
    });

    it('advances to the next view on a left flick', () => {
      const { nav, navigated, setClock } = setup();
      swipe(nav, -30, 120, setClock);
      expect(nav.activeView.value).toBe('war-plan');
      expect(navigated).toEqual(['war-plan']);
    });

    it('goes to the previous view on a right flick, wrapping to the last view', () => {
      const { nav, navigated, setClock } = setup();
      swipe(nav, 30, 100, setClock); // right flick from the first view
      expect(nav.targetPercent.value).toBe(-100); // reset after finalize
      expect(nav.activeView.value).toBe('owner'); // wrapped
      expect(navigated).toEqual(['owner']);
    });

    it('changes view on a slow drag past 40% of the width', () => {
      const { nav, navigated, setClock } = setup();
      swipe(nav, -200, 800, setClock);
      expect(nav.activeView.value).toBe('war-plan');
      expect(navigated).toEqual(['war-plan']);
    });

    it('exposes the prev target percent while sliding back to a previous view', () => {
      const { nav, setClock } = setup();
      nav.onStart();
      nav.onMove(60);
      setClock(100);
      nav.onEnd();
      expect(nav.targetPercent.value).toBe(0); // slide to centre the prev (left) panel
      nav.onTransitionEnd();
    });
  });

  describe('cancelling a swipe', () => {
    it('snaps back without changing the view on a short slow drag', () => {
      const { nav, navigated, setClock } = setup();
      nav.onStart();
      nav.onMove(-100); // under 160px
      setClock(800);
      nav.onEnd();
      expect(nav.targetPercent.value).toBe(-100); // settle back to centre
      nav.onTransitionEnd();
      expect(navigated).toEqual([]);
      expect(nav.activeView.value).toBe('player-list');
      expect(nav.dragOffset.value).toBe(0);
    });

    it('finalises immediately when there was no movement to animate', () => {
      const { nav, navigated } = setup();
      nav.onStart();
      nav.onMove(0);
      nav.onEnd();
      expect(nav.isAnimating.value).toBe(false);
      expect(navigated).toEqual([]);
    });
  });

  describe('eager-load', () => {
    it('fires once with the wrapped target as soon as the drag direction is known', () => {
      const loaded: string[] = [];
      const { nav } = setup({ onEagerLoad: (t) => loaded.push(t) });
      nav.onStart();
      nav.onMove(12); // rightward from the first view -> prev wraps to owner
      expect(loaded).toEqual(['owner']);
      nav.onMove(40); // continued drag does not re-fire
      expect(loaded).toEqual(['owner']);
    });

    it('works without an onEagerLoad callback', () => {
      const { nav } = setup();
      nav.onStart();
      expect(() => nav.onMove(-10)).not.toThrow();
    });
  });

  describe('prefers-reduced-motion', () => {
    it('skips the 1:1 slide during a drag', () => {
      const { nav } = setup({ prefersReducedMotion: () => true });
      nav.onStart();
      nav.onMove(-80);
      expect(nav.dragOffset.value).toBe(0);
    });

    it('changes the view instantly without animating', () => {
      const { nav, navigated, setClock } = setup({ prefersReducedMotion: () => true });
      nav.onStart();
      nav.onMove(-30);
      setClock(120);
      nav.onEnd();
      expect(nav.isAnimating.value).toBe(false);
      expect(nav.activeView.value).toBe('war-plan');
      expect(navigated).toEqual(['war-plan']);
      expect(nav.animateMs.value).toBe(0);
    });
  });

  describe('external navigation (nav taps / deep links)', () => {
    it('setActiveView centres a view and resets gesture state', () => {
      const { nav } = setup();
      nav.onStart();
      nav.onMove(-40);
      nav.setActiveView('admin');
      expect(nav.activeView.value).toBe('admin');
      expect(nav.prevView.value).toBe('war-plan');
      expect(nav.nextView.value).toBe('owner');
      expect(nav.dragOffset.value).toBe(0);
      expect(nav.isAnimating.value).toBe(false);
    });
  });
});
