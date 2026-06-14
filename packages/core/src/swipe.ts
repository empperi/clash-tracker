export type SwipeDecision = 'next' | 'prev' | 'stay';

export interface SwipeInput {
  /** Net horizontal displacement of the gesture (finger end - start), in px. */
  readonly dx: number;
  /** Width of a single view, in px (used for the slow-drag distance threshold). */
  readonly viewWidth: number;
  /** Total gesture duration, in ms. */
  readonly durationMs: number;
  /** Gesture speed magnitude, |dx| / durationMs, in px/ms. */
  readonly velocity: number;
}

/** A gesture this fast (or faster) is eligible to be treated as a flick. */
export const FLICK_MAX_DURATION_MS = 250;
/** Minimum gesture speed (px/ms) for a flick to commit a view change. */
export const FLICK_MIN_VELOCITY_PX_PER_MS = 0.25;
/** Minimum travel (px) for a flick to count — filters out tap jitter. */
export const FLICK_MIN_DISTANCE_PX = 8;
/** Slow drags commit once they pass this fraction of the view width. */
export const SWIPE_DISTANCE_RATIO = 0.4;

/** Duration (ms) for snapping a not-committed drag back to the current view. */
export const SNAP_BACK_MS = 200;
/** Floor for a settle animation so very fast flicks don't complete jarringly fast. */
export const MIN_ANIMATE_MS = 150;
/** Cap for a slow-drag settle animation so it never drags on too long. */
export const SLOW_DRAG_MAX_ANIMATE_MS = 400;

export interface SwipeTransitionInput {
  /** Whether the gesture committed a view change (`true`) or snaps back (`false`). */
  readonly change: boolean;
  /** The originating gesture duration, in ms. */
  readonly durationMs: number;
}

export interface SwipeTransition {
  /** How long the settle animation should run, in ms. */
  readonly animateMs: number;
}

/**
 * Pure mapping from a resolved gesture to the settle-animation duration.
 *
 * A snap-back (no change) uses a fixed quick duration. A committed change from a quick
 * flick (`durationMs <= 250ms`) completes within 250ms (floored so it isn't jarringly
 * fast); a committed change from a slow, deliberate drag respects the user's pace,
 * capped so it never overstays.
 */
export function swipeTransition({ change, durationMs }: SwipeTransitionInput): SwipeTransition {
  if (!change) return { animateMs: SNAP_BACK_MS };

  if (durationMs <= FLICK_MAX_DURATION_MS) {
    const clamped = Math.min(Math.max(durationMs, MIN_ANIMATE_MS), FLICK_MAX_DURATION_MS);
    return { animateMs: clamped };
  }

  return { animateMs: Math.min(durationMs, SLOW_DRAG_MAX_ANIMATE_MS) };
}

/**
 * Pure decision for a horizontal swipe gesture: should the view change, and which way?
 *
 * A quick flick (`durationMs <= 250ms`) past small distance/velocity thresholds commits a
 * change in the drag direction. Otherwise it is a slow, deliberate drag that only commits
 * once it has travelled past ~40% of the view width; short drags snap back (`'stay'`).
 *
 * @returns `'next'` (dragged left), `'prev'` (dragged right), or `'stay'`.
 */
export function resolveSwipe({ dx, viewWidth, durationMs, velocity }: SwipeInput): SwipeDecision {
  if (viewWidth <= 0) return 'stay';

  const direction: SwipeDecision = dx < 0 ? 'next' : dx > 0 ? 'prev' : 'stay';
  if (direction === 'stay') return 'stay';

  const absDx = Math.abs(dx);

  const isFlick =
    durationMs <= FLICK_MAX_DURATION_MS &&
    Math.abs(velocity) >= FLICK_MIN_VELOCITY_PX_PER_MS &&
    absDx >= FLICK_MIN_DISTANCE_PX;
  if (isFlick) return direction;

  if (absDx >= SWIPE_DISTANCE_RATIO * viewWidth) return direction;

  return 'stay';
}
