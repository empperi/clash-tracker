import { ref, type InjectionKey, type Ref } from 'vue';

/**
 * Whether the current viewer may see players who have left the clan (admin/owner).
 * Injected so the real value can arrive with Track 6's auth; until then it is a
 * `ref(false)` provided in main.ts. Components inject it read-only.
 */
export const CAN_VIEW_PAST_PLAYERS: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('canViewPastPlayers');

/** Default capability ref (no past-players access) — used as the provided/fallback value. */
export function createCapabilities(): { canViewPastPlayers: Ref<boolean> } {
  return { canViewPastPlayers: ref(false) };
}
