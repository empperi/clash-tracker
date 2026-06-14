import { ref, type Ref } from 'vue';
import { useSwipe } from '@vueuse/core';
import { resolveSwipe, swipeTransition, type SwipeDecision } from '@clash-tracker/core';

export interface UseSwipeNavOptions {
  /** Ordered view ids (e.g. route names) defining left/right adjacency. */
  readonly order: readonly string[];
  /** Returns the current view id. */
  readonly current: () => string;
  /** Commits navigation to a target view id (e.g. `router.push`). */
  readonly navigate: (target: string) => void;
  /** Returns the current view width in px (for the slow-drag distance threshold). */
  readonly viewWidth: () => number;
  /** Optional element to bind VueUse `useSwipe` to. Omit in unit tests. */
  readonly target?: Ref<HTMLElement | null>;
  /** Injectable clock (ms). Defaults to `Date.now`. */
  readonly now?: () => number;
  /**
   * Called once per gesture as soon as the drag direction is known, with the target view
   * id — so the destination view can start loading its data while the swipe is still in
   * progress (not after the animation finishes). No-op at an edge with no neighbor.
   */
  readonly onEagerLoad?: (target: string) => void;
}

export interface SwipeNav {
  /** Live horizontal translate of the view container during a drag (px). */
  readonly dragOffset: Ref<number>;
  readonly isDragging: Ref<boolean>;
  readonly isAnimating: Ref<boolean>;
  /** Duration of the in-flight settle animation (ms). */
  readonly animateMs: Ref<number>;
  /** Begin a gesture. */
  readonly onStart: () => void;
  /** Update the gesture's horizontal displacement (px, signed: left negative). */
  readonly onMove: (dx: number) => void;
  /** End a gesture: decide, navigate if committed, and set the settle animation. */
  readonly onEnd: () => void;
  /** Clear the animating flag (call on the container's `transitionend`). */
  readonly endAnimation: () => void;
}

/**
 * Swipe-driven view navigation. During a drag the container follows the finger 1:1; on
 * release the pure `resolveSwipe`/`swipeTransition` decide whether to change view and how
 * long to animate. The gesture handlers are exposed so they can be driven directly in
 * tests without real touch events.
 */
export function useSwipeNav(options: UseSwipeNavOptions): SwipeNav {
  const { order, current, navigate, viewWidth, now = () => Date.now(), onEagerLoad } = options;

  const dragOffset = ref(0);
  const isDragging = ref(false);
  const isAnimating = ref(false);
  const animateMs = ref(0);

  let startTime = 0;
  let lastDx = 0;
  let eagerFired = false;

  function neighbor(decision: SwipeDecision): string | null {
    const index = order.indexOf(current());
    if (index === -1) return null;
    if (decision === 'next') return order[index + 1] ?? null;
    if (decision === 'prev') return order[index - 1] ?? null;
    return null;
  }

  function onStart(): void {
    isDragging.value = true;
    isAnimating.value = false;
    startTime = now();
    lastDx = 0;
    eagerFired = false;
    dragOffset.value = 0;
  }

  function maybeEagerLoad(dx: number): void {
    if (eagerFired || !onEagerLoad || dx === 0) return;
    const target = neighbor(dx < 0 ? 'next' : 'prev');
    if (target !== null) {
      onEagerLoad(target);
      eagerFired = true;
    }
  }

  function onMove(dx: number): void {
    if (!isDragging.value) return;
    lastDx = dx;
    dragOffset.value = dx; // follow the finger 1:1
    maybeEagerLoad(dx);
  }

  function onEnd(): void {
    if (!isDragging.value) return;
    isDragging.value = false;

    const durationMs = Math.max(now() - startTime, 0);
    const velocity = durationMs > 0 ? Math.abs(lastDx) / durationMs : 0;
    const decision = resolveSwipe({ dx: lastDx, viewWidth: viewWidth(), durationMs, velocity });
    const target = neighbor(decision);
    const change = decision !== 'stay' && target !== null;

    animateMs.value = swipeTransition({ change, durationMs }).animateMs;
    isAnimating.value = true;
    dragOffset.value = 0; // settle; the container animates from its dragged offset back to 0

    if (change && target) navigate(target);
  }

  function endAnimation(): void {
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

  return { dragOffset, isDragging, isAnimating, animateMs, onStart, onMove, onEnd, endAnimation };
}
