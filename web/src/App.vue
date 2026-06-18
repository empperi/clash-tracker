<script setup lang="ts">
import { computed, ref, watch, inject, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { useSwipeNav } from './composables/useSwipeNav';
import { createEagerLoader } from './composables/eagerLoad';
import { PLAYERS_API, EMPTY_PLAYERS_API } from './api/players';
import { VIEW_ORDER, componentForView } from './views/registry';
import AppHeader from './components/AppHeader.vue';
import AppNav from './components/AppNav.vue';

const route = useRoute();
const router = useRouter();
const viewport = ref<HTMLElement | null>(null);

const eagerLoad = createEagerLoader(useQueryClient(), inject(PLAYERS_API, EMPTY_PLAYERS_API));

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initialView = route.name ? String(route.name) : (VIEW_ORDER[0] ?? 'player-list');

const {
  activeView,
  prevView,
  nextView,
  dragOffset,
  isAnimating,
  animateMs,
  targetPercent,
  onTransitionEnd,
  setActiveView,
} = useSwipeNav({
  order: VIEW_ORDER,
  initial: initialView,
  navigate: (view) => {
    void router.push({ name: view });
  },
  viewWidth: () => viewport.value?.clientWidth ?? 0,
  target: viewport,
  prefersReducedMotion,
  onEagerLoad: eagerLoad,
});

// Keep the carousel in sync with external navigation (nav taps, deep links, back/forward).
watch(
  () => route.name,
  (name) => {
    if (name && String(name) !== activeView.value) setActiveView(String(name));
  }
);

// Reset scroll positions of panels when the active view changes
watch(activeView, () => {
  nextTick(() => {
    const panels = viewport.value?.querySelectorAll('.swipe-panel');
    if (panels) {
      panels.forEach((panel) => {
        panel.scrollTop = 0;
      });
    }
  });
});

const trackStyle = computed(() =>
  isAnimating.value
    ? {
        transform: `translateX(${targetPercent.value}%)`,
        transition: `transform ${animateMs.value}ms ease-out`,
      }
    : {
        transform: `translateX(calc(-100% + ${dragOffset.value}px))`,
        transition: 'none',
      }
);

function handleTransitionEnd(event: TransitionEvent): void {
  if (event.propertyName === 'transform') onTransitionEnd();
}
</script>

<template>
  <div class="app-container">
    <AppHeader />
    <main ref="viewport" class="app-viewport">
      <div class="swipe-track" :style="trackStyle" @transitionend="handleTransitionEnd">
        <section class="swipe-panel" aria-hidden="true">
          <component :is="componentForView(prevView)" :key="`prev-${prevView}`" />
        </section>
        <section class="swipe-panel">
          <component :is="componentForView(activeView)" :key="`active-${activeView}`" />
        </section>
        <section class="swipe-panel" aria-hidden="true">
          <component :is="componentForView(nextView)" :key="`next-${nextView}`" />
        </section>
      </div>
    </main>
    <AppNav />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.app-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
}
.swipe-track {
  display: flex;
  height: 100%;
  width: 100%;
  /* Centre the middle (active) panel; neighbours sit just off-screen on either side. */
  will-change: transform;
}
.swipe-panel {
  flex: 0 0 100%;
  min-width: 100%;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 80px;
}
</style>
