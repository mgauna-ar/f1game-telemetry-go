import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRadioHere } from './useRadioHere';
import { useDesktopStore } from '../store/useDesktopStore';
import { api, ApiError } from '../utils/apiClient';
import type { DesktopState } from '../types/desktop';

type HostWindow = Window & { chrome?: { webview?: unknown } };

const desktop = (nativeWindow: boolean): DesktopState => ({
  show_window_at_start: true,
  start_with_os: false,
  start_with_os_available: nativeWindow,
  native_window: nativeWindow,
  can_update: false,
});

describe('useRadioHere', () => {
  beforeEach(() => {
    useDesktopStore.setState({ state: null, requested: false });
  });

  afterEach(() => {
    delete (window as HostWindow).chrome;
    window.name = '';
    vi.restoreAllMocks();
  });

  it('speaks only in the app window on a PC that has one', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(desktop(true));
    const { result } = renderHook(() => useRadioHere());
    await waitFor(() => expect(result.current).toBe(false));
    expect(get).toHaveBeenCalledWith('/api/desktop', undefined);
  });

  it('speaks in a browser on macOS or Linux, where the app has no window of its own', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(desktop(false));
    const { result } = renderHook(() => useRadioHere());
    await waitFor(() => expect(useDesktopStore.getState().state).not.toBeNull());
    expect(result.current).toBe(true);
  });

  it('speaks on a phone or tablet, which the PC-only state refuses', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError('only available on the PC the app runs on', 403, 'Forbidden'));
    const { result } = renderHook(() => useRadioHere());
    await waitFor(() => expect(useDesktopStore.getState().requested).toBe(true));
    expect(result.current).toBe(true);
  });

  it('speaks in the main window and never in the Race Control window', () => {
    const get = vi.spyOn(api, 'get');
    (window as HostWindow).chrome = { webview: {} };
    expect(renderHook(() => useRadioHere()).result.current).toBe(true);

    window.name = 'race-control';
    expect(renderHook(() => useRadioHere()).result.current).toBe(false);
    // The windows know which they are: they don't ask the app
    expect(get).not.toHaveBeenCalled();
  });
});
