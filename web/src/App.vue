<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useSwipeNav } from './composables/useSwipeNav';
import AppHeader from './components/AppHeader.vue';
import AppNav from './components/AppNav.vue';

// Left-to-right order of the swipeable views; must mirror the router.
const VIEW_ORDER = ['player-list', 'war-plan', 'admin', 'owner'] as const;

const route = useRoute();
const router = useRouter();
const container = ref<HTMLElement | null>(null);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { dragOffset, isAnimating, animateMs, endAnimation } = useSwipeNav({
  order: VIEW_ORDER,
  current: () => (route.name ? String(route.name) : VIEW_ORDER[0]),
  navigate: (name) => {
    void router.push({ name });
  },
  viewWidth: () => container.value?.clientWidth ?? 0,
  target: container,
  prefersReducedMotion,
  // onEagerLoad is intentionally omitted until views expose data loaders (Track 5).
});

const contentStyle = computed(() => ({
  transform: `translateX(${dragOffset.value}px)`,
  transition: isAnimating.value ? `transform ${animateMs.value}ms ease-out` : 'none',
}));
</script>

<template>
  <div class="app-container">
    <AppHeader />
    <main ref="container" class="app-content">
      <div class="swipe-content" :style="contentStyle" @transitionend="endAnimation">
        <RouterView />
      </div>
    </main>
    <AppNav />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.app-content {
  flex: 1;
  overflow-x: hidden;
  touch-action: pan-y;
}
.swipe-content {
  height: 100%;
  will-change: transform;
}
</style>
