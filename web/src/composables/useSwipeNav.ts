import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useSwipe } from '@vueuse/core';
import { resolveSwipe, swipeTransition, type SwipeDecision } from '@clash-tracker/core';

export interface UseSwipeNavOptions {
  /** Ordered view ids (e.g. route names). Adjacency wraps around (a ring). */
  readonly order: readonly string[];
  /** The initially centred view id. */
  readonly initial: string;
  /** Syncs external navigation (e.g. `router.push`) when a swipe commits. */
  readonly navigate: (view: string) => void;
  /** Returns the current viewport width in px (for the slow-drag distance threshold). */
  readonly viewWidth: () => number;
  /** Optional element to bind VueUse `useSwipe` to. Omit in unit tests. */
  readonly target?: Ref<HTMLElement | null>;
  /** Injectable clock (ms). Defaults to `Date.now`. */
  readonly now?: () => number;
  /**
   * Called once per gesture as soon as the drag direction is known, with the target view
   * id — so the destination view can start loading while the swipe is still in progress.
   */
  readonly onEagerLoad?: (view: string) => void;
  /**
   * Injected reduced-motion matcher (don't read `window` directly). When `true`, the 1:1
   * slide is skipped and a committed change happens instantly (`animateMs === 0`).
   */
  readonly prefersReducedMotion?: () => boolean;
}

export interface SwipeNav {
  /** The currently centred view id. */
  readonly activeView: Ref<string>;
  /** The previous (left) view id, wrapping around. */
  readonly prevView: ComputedRef<string>;
  /** The next (right) view id, wrapping around. */
  readonly nextView: ComputedRef<string>;
  /** Live horizontal translate of the track during a drag (px, signed: left negative). */
  readonly dragOffset: Ref<number>;
  readonly isDragging: Ref<boolean>;
  readonly isAnimating: Ref<boolean>;
  /** Duration of the in-flight settle animation (ms). */
  readonly animateMs: Ref<number>;
  /**
   * The track translate target (in % of viewport) during the settle animation:
   * `-100` centres the current panel (snap back), `-200` the next panel, `0` the prev panel.
   */
  readonly targetPercent: ComputedRef<number>;
  readonly onStart: () => void;
  readonly onMove: (dx: number) => void;
  readonly onEnd: () => void;
  /** Finalise the settle: swap the centred view (after the slide), navigate, reset. */
  readonly onTransitionEnd: () => void;
  /** Centre a view from outside a swipe (nav tap / deep link), resetting gesture state. */
  readonly setActiveView: (view: string) => void;
}

/**
 * Swipe-driven carousel navigation between views arranged in a ring.
 *
 * During a drag the track follows the finger 1:1, revealing the adjacent (wrapped) view
 * from the side. On release the pure `resolveSwipe`/`swipeTransition` decide whether to
 * commit and how long to animate; the track then *slides* to centre the target panel and
 * the centred view is swapped only once that settle transition ends — so a committed swipe
 * reads as the new view arriving from the side, never a bounce-back-then-swap.
 */
export function useSwipeNav(options: UseSwipeNavOptions): SwipeNav {
  const {
    order,
    initial,
    navigate,
    viewWidth,
    now = () => Date.now(),
    onEagerLoad,
    prefersReducedMotion = () => false,
  } = options;

  const activeView = ref(initial);
  const dragOffset = ref(0);
  const isDragging = ref(false);
  const isAnimating = ref(false);
  const animateMs = ref(0);
  const committedDirection = ref<SwipeDecision>('stay');

  let startTime = 0;
  let lastDx = 0;
  let eagerFired = false;

  function wrapped(step: number): string {
    const n = order.length;
    const index = order.indexOf(activeView.value);
    const fallback = order[0] ?? activeView.value;
    if (index === -1 || n === 0) return fallback;
    return order[(index + step + n) % n] ?? fallback;
  }

  const prevView = computed(() => wrapped(-1));
  const nextView = computed(() => wrapped(1));

  const targetPercent = computed(() => {
    if (committedDirection.value === 'next') return -200;
    if (committedDirection.value === 'prev') return 0;
    return -100;
  });

  function onStart(): void {
    if (isAnimating.value) return;
    isDragging.value = true;
    startTime = now();
    lastDx = 0;
    eagerFired = false;
    dragOffset.value = 0;
  }

  function maybeEagerLoad(dx: number): void {
    if (eagerFired || !onEagerLoad || dx === 0) return;
    onEagerLoad(dx < 0 ? nextView.value : prevView.value);
    eagerFired = true;
  }

  function onMove(dx: number): void {
    if (!isDragging.value) return;
    lastDx = dx;
    // Follow the finger 1:1 — unless the user prefers reduced motion (no slide).
    dragOffset.value = prefersReducedMotion() ? 0 : dx;
    maybeEagerLoad(dx);
  }

  function finalize(): void {
    if (committedDirection.value === 'next') {
      activeView.value = nextView.value;
      navigate(activeView.value);
    } else if (committedDirection.value === 'prev') {
      activeView.value = prevView.value;
      navigate(activeView.value);
    }
    committedDirection.value = 'stay';
    dragOffset.value = 0;
    isAnimating.value = false;
  }

  function onEnd(): void {
    if (!isDragging.value) return;
    isDragging.value = false;

    const durationMs = Math.max(now() - startTime, 0);
    const velocity = durationMs > 0 ? Math.abs(lastDx) / durationMs : 0;
    committedDirection.value = resolveSwipe({
      dx: lastDx,
      viewWidth: viewWidth(),
      durationMs,
      velocity,
    });
    const change = committedDirection.value !== 'stay';

    // Reduced motion, or nothing to animate -> finalise instantly (no slide).
    if (prefersReducedMotion()) {
      animateMs.value = 0;
      finalize();
      return;
    }

    animateMs.value = swipeTransition({ change, durationMs }).animateMs;

    if (!change && dragOffset.value === 0) {
      finalize();
      return;
    }

    // Slide to centre the target panel; the centred view swaps on transition end.
    isAnimating.value = true;
  }

  function onTransitionEnd(): void {
    if (!isAnimating.value) return;
    finalize();
  }

  function setActiveView(view: string): void {
    activeView.value = view;
    committedDirection.value = 'stay';
    dragOffset.value = 0;
    isDragging.value = false;
    isAnimating.value = false;
  }

  if (options.target) {
    const { lengthX } = useSwipe(options.target, {
      onSwipeStart: () => onStart(),
      // VueUse lengthX = startX - currentX, so a leftward drag is positive; negate to our dx.
      onSwipe: () => onMove(-lengthX.value),
      onSwipeEnd: () => onEnd(),
    });
  }

  return {
    activeView,
    prevView,
    nextView,
    dragOffset,
    isDragging,
    isAnimating,
    animateMs,
    targetPercent,
    onStart,
    onMove,
    onEnd,
    onTransitionEnd,
    setActiveView,
  };
}
