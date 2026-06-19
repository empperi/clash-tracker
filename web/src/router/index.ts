import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { VIEWS } from '../views/registry';
import LoginView from '../views/LoginView.vue';

const routes: RouteRecordRaw[] = [
  ...VIEWS.map((view) => ({
    path: view.path,
    name: view.name,
    component: view.component,
  })),
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
