import { useLayoutEffect, type RefObject } from 'react';

/** The app window's size: the one the server opens it at on Windows and Linux (internal/desktop/app.go). */
export const APP_WINDOW_SIZE = { width: 440, height: 720 } as const;

/** The parts of a window fitWindowToContent reads and resizes. */
type FittableWindow = Pick<Window, 'innerHeight' | 'outerHeight' | 'outerWidth' | 'resizeTo'> & {
  document: { documentElement: Pick<HTMLElement, 'scrollHeight'> };
  screen: Pick<Screen, 'availHeight'>;
};

/**
 * Gives a window that opened at another width the app window's size, and reports whether it did.
 * On macOS the server opens the app window in the user's own Chrome, which picks its size: its
 * default for a new app window, then the size it was last left at.
 */
export function sizeAppWindow(win: Pick<Window, 'outerWidth' | 'resizeTo'>): boolean {
  if (win.outerWidth === APP_WINDOW_SIZE.width) return false;
  win.resizeTo(APP_WINDOW_SIZE.width, APP_WINDOW_SIZE.height);
  return true;
}

/**
 * Grows the window so its content fits without a scroll bar, up to the screen's height, keeping it
 * `width` wide. The app window opens at a fixed size, but its content grows with the PC's network
 * addresses, the Windows-only switch and the language. A normal browser tab ignores resizeTo.
 */
export function fitWindowToContent(win: FittableWindow, width = win.outerWidth): void {
  const overflow = win.document.documentElement.scrollHeight - win.innerHeight;
  if (overflow <= 0) return;
  const height = Math.min(win.outerHeight + overflow, win.screen.availHeight);
  if (height > win.outerHeight) win.resizeTo(width, height);
}

/** Opens the app window at its size and keeps it tall enough for the element's content as it loads and changes. */
export function useFitWindowToContent(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A resize applies a moment later: until then the window reports its old width, which fitting
    // would otherwise put back
    let opening = sizeAppWindow(window);
    const fit = () => {
      if (opening && window.outerWidth === APP_WINDOW_SIZE.width) opening = false;
      fitWindowToContent(window, opening ? APP_WINDOW_SIZE.width : window.outerWidth);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}
