import type { InjectionKey } from 'vue';

/** Minimal observer surface the infinite-scroll section needs. */
export interface ScrollObserver {
  observe(el: Element): void;
  disconnect(): void;
}

/** Builds an observer that calls `onIntersect` when an observed element scrolls into view. */
export type ObserverFactory = (onIntersect: () => void) => ScrollObserver;

/** Injection key so tests can supply a fake factory and drive intersection manually. */
export const OBSERVER_FACTORY: InjectionKey<ObserverFactory> = Symbol('observerFactory');

/** Real IntersectionObserver-backed factory (the inject fallback). */
export const defaultObserverFactory: ObserverFactory = (onIntersect) => {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      onIntersect();
    }
  });
  return {
    observe: (el) => io.observe(el),
    disconnect: () => io.disconnect(),
  };
};
