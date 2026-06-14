import type { Component } from 'vue';
import PlayerListView from './PlayerListView.vue';
import WarPlanView from './WarPlanView.vue';
import AdminView from './AdminView.vue';
import OwnerView from './OwnerView.vue';

export interface ViewDef {
  /** Route name and swipe-carousel id. */
  readonly name: string;
  /** URL path. */
  readonly path: string;
  readonly component: Component;
}

/**
 * Single source of truth for the top-level views: their order (left→right, wrapping),
 * routes, and components. Consumed by both the router and the swipe carousel so the two
 * never drift. Components are imported statically because the carousel renders the
 * neighbouring views alongside the active one during a drag.
 */
export const VIEWS: readonly ViewDef[] = [
  { name: 'player-list', path: '/', component: PlayerListView },
  { name: 'war-plan', path: '/war-plan', component: WarPlanView },
  { name: 'admin', path: '/admin', component: AdminView },
  { name: 'owner', path: '/owner', component: OwnerView },
];

export const VIEW_ORDER: readonly string[] = VIEWS.map((v) => v.name);

const BY_NAME = new Map(VIEWS.map((v) => [v.name, v.component]));

/** The component for a view id, falling back to the Player List view if unknown. */
export function componentForView(name: string): Component {
  return BY_NAME.get(name) ?? PlayerListView;
}
