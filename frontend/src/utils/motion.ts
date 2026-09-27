/**
 * True when the OS asks for less motion. JS-driven animation (canvas loops, smooth scrolling)
 * checks this; CSS animation is covered by styles/base/accessibility.css.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
