import { useMemo, useSyncExternalStore } from 'react';
import { buildPath, parseRoute, type CompareParams, type Route } from './routes';

/**
 * A small router over the History API: `navigate` changes the URL, and every `useRoute` reader
 * re-renders on it and on the browser's back and forward buttons.
 */

const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', notify);
  };
};

const currentUrl = () => window.location.pathname + window.location.search;

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one: for changes within a page. */
  replace?: boolean;
}

/** Opens a URL of the dashboard. A new page starts scrolled to the top. */
export function navigate(to: string, { replace = false }: NavigateOptions = {}): void {
  if (to === currentUrl()) return;
  const samePage = new URL(to, window.location.origin).pathname === window.location.pathname;
  if (replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
    if (!samePage) window.scrollTo?.(0, 0);
  }
  notify();
}

/** The current URL, path and query. */
export function useUrl(): string {
  return useSyncExternalStore(subscribe, currentUrl);
}

/** The page the URL shows, with defaults filled in. */
export function useRoute(): Route {
  const url = useUrl();
  return useMemo(() => {
    const { pathname, search } = new URL(url, window.location.origin);
    return parseRoute(pathname, search);
  }, [url]);
}

/** Opens the comparator with the given sessions and laps. */
export function openComparator(params: CompareParams): void {
  navigate(buildPath({ page: 'compare', ...params }));
}
