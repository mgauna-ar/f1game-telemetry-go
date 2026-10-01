import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useScreenWakeLock } from './useScreenWakeLock';

const setWakeLock = (value: unknown) =>
  Object.defineProperty(navigator, 'wakeLock', { value, configurable: true, writable: true });

describe('useScreenWakeLock', () => {
  afterEach(() => {
    // jsdom has no wake lock; leave it that way for the other tests
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    vi.restoreAllMocks();
  });

  it('holds a screen wake lock where the browser has one, and releases it', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ released: false, release }));
    setWakeLock({ request });

    const { result, unmount } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.mode).toBe('wake-lock'));
    expect(request).toHaveBeenCalledWith('screen');

    unmount();
    expect(release).toHaveBeenCalled();
  });

  it('falls back to a muted looping video without the wake lock API', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.mode).toBe('video'));

    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video!.muted).toBe(true);
    expect(video!.loop).toBe(true);
    expect(play).toHaveBeenCalled();

    unmount();
    expect(document.querySelector('video')).toBeNull();
  });

  it('reports blocked when the browser refuses both, and retries from a tap', async () => {
    setWakeLock({ request: vi.fn(() => Promise.reject(new Error('not allowed'))) });
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('autoplay'));
    const { result } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.mode).toBe('blocked'));

    play.mockResolvedValue(undefined);
    result.current.retry();
    await waitFor(() => expect(result.current.mode).toBe('video'));
  });

  it('does nothing while inactive', () => {
    const { result } = renderHook(() => useScreenWakeLock(false));
    expect(result.current.mode).toBe('off');
    expect(document.querySelector('video')).toBeNull();
  });
});
