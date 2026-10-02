import { useLayoutEffect, type RefObject } from 'react';

/** The parts of a window fitWindowToContent reads and resizes. */
type FittableWindow = Pick<Window, 'innerHeight' | 'outerHeight' | 'outerWidth' | 'resizeTo'> & {
  document: { documentElement: Pick<HTMLElement, 'scrollHeight'> };
  screen: Pick<Screen, 'availHeight'>;
};

/**
 * Grows the window so its content fits without a scroll bar, up to the screen's height. The
 * server opens the app window at a fixed size, but its content grows with the PC's network
 * addresses, the Windows-only switch and the language. A normal browser tab ignores resizeTo.
 */
export function fitWindowToContent(win: FittableWindow): void {
  const overflow = win.document.documentElement.scrollHeight - win.innerHeight;
  if (overflow <= 0) return;
  const height = Math.min(win.outerHeight + overflow, win.screen.availHeight);
  if (height > win.outerHeight) win.resizeTo(win.outerWidth, height);
}

/** Keeps the app window tall enough for the element's content as it loads and changes. */
export function useFitWindowToContent(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => fitWindowToContent(window);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}
