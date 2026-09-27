import { useCallback, useSyncExternalStore } from 'react';

const mediaList = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/**
 * Whether a media query matches, updated as the window resizes. Pair it with the named widths in
 * `styles/breakpoints.ts`: `useMediaQuery(maxWidth('tablet'))`. False where there is no
 * `matchMedia` (tests), so the wide layout is the default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => mediaList(query)?.matches ?? false);
}
