import { navigate } from '../router/router';
import type { DesktopWindowName } from '../types/desktop';
import { desktopClient } from './desktopClient';

/**
 * The app's own windows on Windows (internal/desktop): WebView2 windows that load the dashboard
 * the app serves. A page tells it's in one by WebView2's `chrome.webview`, which browsers don't have.
 */

/**
 * The race engineer's page (`Root.tsx` renders it instead of the dashboard): the voice cockpit on
 * its own, which the engineer window shows. On Windows the radio speaks and listens there.
 */
export const ENGINEER_PATH = '/engineer';
const ENGINEER_WINDOW: DesktopWindowName = 'engineer';

/** Whether this page is the race engineer's rather than the dashboard. */
export const isEngineerPath = (pathname: string): boolean => pathname === ENGINEER_PATH;

interface WebViewHost {
  chrome?: { webview?: unknown };
}

/** Whether this page shows in one of the app's own windows rather than in a browser. */
export const isNativeWindow = (): boolean =>
  typeof window !== 'undefined' && (window as WebViewHost).chrome?.webview !== undefined;

/**
 * Notes which of the app's windows this is, when it opens: the engineer window opens on
 * /engineer, and its name keeps that through reloads.
 */
export function markNativeWindow(): void {
  if (isEngineerPath(window.location.pathname)) {
    window.name = ENGINEER_WINDOW;
  }
}

/** Whether this page is the app's engineer window, the one place the radio speaks on its PC. */
export const isEngineerWindow = (): boolean => isNativeWindow() && window.name === ENGINEER_WINDOW;

/**
 * Makes links behave in the app's window as they would in an app: a page from another site (release
 * notes, a provider's keys page, a link in an AI answer) opens in the default browser, and a page of
 * the dashboard meant for a new tab opens in the window itself. The engineer window shows only the
 * engineer, so there a page of the dashboard opens in the main window, caught before a dashboard
 * link moves the engineer window to it. Without this, WebView2 would open such links in a bare
 * window of its own. Returns a function that undoes it.
 */
export function openLinksOutside(onError: (err: unknown) => void): () => void {
  const engineer = isEngineerWindow();
  const onClick = (event: MouseEvent) => {
    const middleClick = event.type === 'auxclick' && event.button === 1;
    const leftClick = event.type === 'click' && event.button === 0;
    if (event.defaultPrevented || !(leftClick || middleClick)) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const url = new URL(anchor.href, window.location.href);
    const page = url.pathname + url.search + url.hash;
    if (url.origin === window.location.origin) {
      if (engineer) {
        if (url.pathname === window.location.pathname) return;
        event.preventDefault();
        desktopClient.showWindow('main', page).catch(onError);
        return;
      }
      const newTab = middleClick || anchor.target === '_blank' || event.ctrlKey || event.shiftKey || event.metaKey;
      if (!newTab) return;
      event.preventDefault();
      navigate(page);
      return;
    }
    event.preventDefault();
    desktopClient.openLink(url.href).catch(onError);
  };
  // In the engineer window it listens first, before a dashboard link handles the click itself
  document.addEventListener('click', onClick, engineer);
  document.addEventListener('auxclick', onClick, engineer);
  return () => {
    document.removeEventListener('click', onClick, engineer);
    document.removeEventListener('auxclick', onClick, engineer);
  };
}
