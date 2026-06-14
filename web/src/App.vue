<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSwipeNav } from './composables/useSwipeNav';
import { VIEW_ORDER, componentForView } from './views/registry';
import AppHeader from './components/AppHeader.vue';
import AppNav from './components/AppNav.vue';

const route = useRoute();
const router = useRouter();
const viewport = ref<HTMLElement | null>(null);

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
  // onEagerLoad is wired once views expose data loaders (Track 5).
});

// Keep the carousel in sync with external navigation (nav taps, deep links, back/forward).
watch(
  () => route.name,
  (name) => {
    if (name && String(name) !== activeView.value) setActiveView(String(name));
  }
);

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
  min-height: 100vh;
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
}
</style>
