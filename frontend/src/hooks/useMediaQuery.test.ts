import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';
import { maxWidth } from '../styles/breakpoints';

/** A matchMedia stand-in whose answer the test changes. */
const fakeMatchMedia = (initial: boolean) => {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => list)
  );
  return {
    set(matches: boolean) {
      list.matches = matches;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
};

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false where there is no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery(maxWidth('tablet')));
    expect(result.current).toBe(false);
  });

  it('follows the query as the window resizes, and stops listening on unmount', () => {
    const media = fakeMatchMedia(false);
    const { result, unmount } = renderHook(() => useMediaQuery(maxWidth('tablet')));
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 900px)');
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
