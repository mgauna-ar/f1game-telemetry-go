import { navigate } from '../router/router';
import type { DesktopWindowName } from '../types/desktop';
import { desktopClient } from './desktopClient';

/**
 * The app's own windows on Windows (internal/desktop): WebView2 windows that load the dashboard
 * the app serves. A page tells it's in one by WebView2's `chrome.webview`, which browsers don't have.
 */

/** The query parameter the app opens its Race Control window with (`?window=race-control`). */
export const WINDOW_PARAM = 'window';
const RACE_CONTROL_WINDOW: DesktopWindowName = 'race-control';

interface WebViewHost {
  chrome?: { webview?: unknown };
}

/** Whether this page shows in one of the app's own windows rather than in a browser. */
export const isNativeWindow = (): boolean =>
  typeof window !== 'undefined' && (window as WebViewHost).chrome?.webview !== undefined;

/**
 * Notes which of the app's windows this is, when it opens: the Race Control window opens with
 * `?window=race-control`, and its name keeps that through reloads and the pages opened in it.
 */
export function markNativeWindow(): void {
  if (new URLSearchParams(window.location.search).get(WINDOW_PARAM) === RACE_CONTROL_WINDOW) {
    window.name = RACE_CONTROL_WINDOW;
  }
}

/** Whether this page is the app's Race Control window, which shows Race Control and never speaks. */
export const isRaceControlWindow = (): boolean => isNativeWindow() && window.name === RACE_CONTROL_WINDOW;

/** Opens the app's Race Control window, or brings it up, for a second monitor. */
export const openRaceControlWindow = (): Promise<unknown> => desktopClient.showWindow(RACE_CONTROL_WINDOW);

/**
 * Makes links behave in the app's window as they would in an app: a page from another site (release
 * notes, a provider's keys page, a link in an AI answer) opens in the default browser, and a page of
 * the dashboard meant for a new tab opens in the window itself. Without this, WebView2 would open
 * such links in a bare window of its own. Returns a function that undoes it.
 */
export function openLinksOutside(onError: (err: unknown) => void): () => void {
  const onClick = (event: MouseEvent) => {
    const middleClick = event.type === 'auxclick' && event.button === 1;
    const leftClick = event.type === 'click' && event.button === 0;
    if (event.defaultPrevented || !(leftClick || middleClick)) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin) {
      const newTab = middleClick || anchor.target === '_blank' || event.ctrlKey || event.shiftKey || event.metaKey;
      if (!newTab) return;
      event.preventDefault();
      navigate(url.pathname + url.search + url.hash);
      return;
    }
    event.preventDefault();
    desktopClient.openLink(url.href).catch(onError);
  };
  document.addEventListener('click', onClick);
  document.addEventListener('auxclick', onClick);
  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('auxclick', onClick);
  };
}
