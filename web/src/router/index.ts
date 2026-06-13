import { createRouter, createWebHistory } from 'vue-router';
import PlayerListView from '../views/PlayerListView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'player-list',
      component: PlayerListView,
    },
    {
      path: '/war-plan',
      name: 'war-plan',
      component: () => import('../views/WarPlanView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
    },
    {
      path: '/owner',
      name: 'owner',
      component: () => import('../views/OwnerView.vue'),
    },
  ],
});

export default router;
