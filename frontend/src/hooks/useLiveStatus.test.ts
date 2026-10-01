import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLiveStatus } from './useLiveStatus';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { subscribeSystemStatus, useSystemStatusStore } from '../store/useSystemStatusStore';
import { getLastTelemetryMessageAt } from '../utils/telemetrySocket';
import type { SessionData } from '../types/telemetry';

vi.mock('../utils/telemetrySocket', () => ({
  getLastTelemetryMessageAt: vi.fn(() => 0),
}));

vi.mock('../store/useSystemStatusStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/useSystemStatusStore')>();
  return { ...actual, subscribeSystemStatus: vi.fn(() => () => {}) };
});

const session = { TrackId: 0, SessionType: 15 } as SessionData;

describe('useLiveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(subscribeSystemStatus).mockClear();
    useSessionStatusStore.setState({ connected: false, session: null });
    useSystemStatusStore.setState({ liveStatus: 'offline', session: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls the server off the Live tab and reports what it says', () => {
    const { result } = renderHook(() => useLiveStatus());
    expect(subscribeSystemStatus).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('offline');

    act(() => useSystemStatusStore.setState({ liveStatus: 'live' }));
    expect(result.current).toBe('live');
  });

  it('is listening when connected but no session has arrived, without polling', () => {
    useSessionStatusStore.setState({ connected: true, session: null });
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe('listening');
    expect(subscribeSystemStatus).not.toHaveBeenCalled();
  });

  it('is live while packets keep arriving and stale once they stop', () => {
    vi.mocked(getLastTelemetryMessageAt).mockImplementation(() => Date.now());
    useSessionStatusStore.setState({ connected: true, session });
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe('live');

    // Packets stop: the last message time freezes while the clock moves on
    const frozenAt = Date.now();
    vi.mocked(getLastTelemetryMessageAt).mockImplementation(() => frozenAt);
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current).toBe('stale');

    // Packets come back
    vi.mocked(getLastTelemetryMessageAt).mockImplementation(() => Date.now());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe('live');
  });
});
