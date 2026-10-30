import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDesktopStore } from './useDesktopStore';
import { api, ApiError } from '../utils/apiClient';
import type { DesktopState } from '../types/desktop';

const state: DesktopState = {
  show_window_at_start: true,
  start_with_os: false,
  start_with_os_available: true,
  native_window: true,
  can_update: true,
};

describe('useDesktopStore', () => {
  beforeEach(() => {
    useDesktopStore.setState({ state: null, status: 'idle' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the state once, again on refresh, and keeps it when a later read fails', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce(state)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await useDesktopStore.getState().load();
    await useDesktopStore.getState().load();
    expect(get).toHaveBeenCalledTimes(1);
    expect(useDesktopStore.getState()).toMatchObject({ state, status: 'ready' });

    await useDesktopStore.getState().refresh();
    expect(get).toHaveBeenCalledTimes(2);
    expect(useDesktopStore.getState()).toMatchObject({ state, status: 'ready' });
  });

  it('is unavailable on a device the server refuses', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError('only available on the PC the app runs on', 403, 'Forbidden'));
    await useDesktopStore.getState().load();
    expect(useDesktopStore.getState()).toMatchObject({ state: null, status: 'unavailable' });
  });

  it('keeps what the server saved, and the old state when a change fails', async () => {
    useDesktopStore.setState({ state, status: 'ready' });
    vi.spyOn(api, 'put')
      .mockResolvedValueOnce({ ...state, start_with_os: true })
      .mockRejectedValueOnce(new Error('disk full'));

    await useDesktopStore.getState().update({ start_with_os: true });
    expect(useDesktopStore.getState().state?.start_with_os).toBe(true);
    await expect(useDesktopStore.getState().update({ start_with_os: false })).rejects.toThrow('disk full');
    expect(useDesktopStore.getState().state?.start_with_os).toBe(true);
  });
});
