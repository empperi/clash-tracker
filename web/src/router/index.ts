import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { VIEWS } from '../views/registry';

const routes: RouteRecordRaw[] = VIEWS.map((view) => ({
  path: view.path,
  name: view.name,
  component: view.component,
}));

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
