import { describe, expect, it } from 'vitest';
import { useSwipeNav, type UseSwipeNavOptions } from './useSwipeNav';

const ORDER = ['player-list', 'war-plan', 'admin', 'owner'] as const;

/** Build a composable with a controllable clock and a navigation spy. */
function setup(overrides: Partial<UseSwipeNavOptions> = {}) {
  let t = 0;
  const navigated: string[] = [];
  let currentView = 'war-plan'; // a middle view so both neighbors exist by default

  const nav = useSwipeNav({
    order: ORDER,
    current: () => currentView,
    navigate: (target) => {
      navigated.push(target);
      currentView = target;
    },
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
    setCurrent: (view: string) => {
      currentView = view;
    },
  };
}

describe('useSwipeNav', () => {
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

  it('navigates to the next view on a left flick and settles the offset', () => {
    const { nav, navigated, setClock } = setup();
    nav.onStart();
    nav.onMove(-30);
    setClock(120); // quick flick
    nav.onEnd();
    expect(navigated).toEqual(['admin']); // war-plan -> next
    expect(nav.isDragging.value).toBe(false);
    expect(nav.isAnimating.value).toBe(true);
    expect(nav.dragOffset.value).toBe(0);
    expect(nav.animateMs.value).toBeLessThanOrEqual(250);
  });

  it('navigates to the previous view on a right flick', () => {
    const { nav, navigated, setClock } = setup();
    nav.onStart();
    nav.onMove(40);
    setClock(100);
    nav.onEnd();
    expect(navigated).toEqual(['player-list']); // war-plan -> prev
  });

  it('changes view on a slow drag past 40% of the width', () => {
    const { nav, navigated, setClock } = setup();
    nav.onStart();
    nav.onMove(-200); // past 160px
    setClock(800); // slow
    nav.onEnd();
    expect(navigated).toEqual(['admin']);
    expect(nav.animateMs.value).toBe(400); // slow drag (800ms) capped at 400ms
  });

  it('snaps back without navigating on a short slow drag', () => {
    const { nav, navigated, setClock } = setup();
    nav.onStart();
    nav.onMove(-100); // under 160px
    setClock(800);
    nav.onEnd();
    expect(navigated).toEqual([]);
    expect(nav.dragOffset.value).toBe(0);
    expect(nav.animateMs.value).toBe(200); // snap-back duration
  });

  it('does not navigate past the start edge', () => {
    const { nav, navigated, setClock } = setup({ current: () => 'player-list' });
    nav.onStart();
    nav.onMove(60); // right flick -> prev, but none exists
    setClock(100);
    nav.onEnd();
    expect(navigated).toEqual([]);
    expect(nav.animateMs.value).toBe(200); // treated as a snap-back
  });

  it('does not navigate past the end edge', () => {
    const { nav, navigated, setClock } = setup({ current: () => 'owner' });
    nav.onStart();
    nav.onMove(-60); // left flick -> next, but none exists
    setClock(100);
    nav.onEnd();
    expect(navigated).toEqual([]);
  });

  it('clears the animating flag on endAnimation', () => {
    const { nav, setClock } = setup();
    nav.onStart();
    nav.onMove(-30);
    setClock(120);
    nav.onEnd();
    expect(nav.isAnimating.value).toBe(true);
    nav.endAnimation();
    expect(nav.isAnimating.value).toBe(false);
  });
});
