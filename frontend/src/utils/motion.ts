/** The attribute on <html> that turns on performance mode's CSS (styles/base/performance.css). */
export const PERFORMANCE_ATTRIBUTE = 'data-performance';

/**
 * True when the OS asks for less motion. JS-driven animation (canvas loops, smooth scrolling)
 * checks this; CSS animation is covered by styles/base/accessibility.css.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True while performance mode is on (see hooks/usePerformanceMode.ts). */
export const isPerformanceModeOn = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.getAttribute(PERFORMANCE_ATTRIBUTE) === 'on';

/** Whether JS-driven motion should stop: the OS asks for less motion or performance mode is on. */
export const shouldReduceMotion = (): boolean => prefersReducedMotion() || isPerformanceModeOn();
