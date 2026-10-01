import { useLayoutEffect, type RefObject } from 'react';

/**
 * Keeps `--nav-height` on <html> equal to the sticky top bar's height (0 while it is hidden), so
 * sticky content (`top: var(--sticky-top)`) starts below it at every width and in every language.
 */
export function useNavHeightVar(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--nav-height', `${Math.round(element.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--nav-height');
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--nav-height');
    };
  }, [ref]);
}
