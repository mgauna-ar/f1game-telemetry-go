import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { api, ApiError } from '../utils/apiClient';
import { UPDATE_POLL_INTERVAL_MS, UPDATE_RESTART_TIMEOUT_MS, useInstallUpdate } from './useInstallUpdate';

describe('useInstallUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('installs, waits for the new version to answer and reloads on it', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ version: 'v1.7.0' });
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({ version: 'v1.6.0' }) // still the old app, shutting down
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // nothing answers while it restarts
      .mockResolvedValue({ version: 'v1.7.0' });
    const reload = vi.fn();
    const { result } = renderHook(() => useInstallUpdate(reload));

    await act(() => result.current.install());
    expect(post).toHaveBeenCalledWith('/api/desktop/update');
    expect(result.current.state).toEqual({ phase: 'restarting', version: 'v1.7.0' });

    await act(() => vi.advanceTimersByTimeAsync(2 * UPDATE_POLL_INTERVAL_MS));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_POLL_INTERVAL_MS));
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenCalledWith('/api/system/version', expect.any(AbortSignal));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("says the app didn't come back when the new version never answers", async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ version: 'v1.7.0' });
    vi.spyOn(api, 'get').mockRejectedValue(new TypeError('Failed to fetch'));
    const reload = vi.fn();
    const { result } = renderHook(() => useInstallUpdate(reload));

    await act(() => result.current.install());
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_RESTART_TIMEOUT_MS + UPDATE_POLL_INTERVAL_MS));
    expect(result.current.state).toEqual({ phase: 'timedOut', version: 'v1.7.0' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reports why the update failed and keeps the app as it is', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError("can't write to /usr/local/bin: permission denied", 500, 'Internal Server Error')
    );
    const get = vi.spyOn(api, 'get');
    const { result } = renderHook(() => useInstallUpdate(vi.fn()));

    await act(() => result.current.install());
    expect(result.current.state).toEqual({
      phase: 'failed',
      error: "can't write to /usr/local/bin: permission denied",
    });
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_POLL_INTERVAL_MS));
    expect(get).not.toHaveBeenCalled();
  });
});
