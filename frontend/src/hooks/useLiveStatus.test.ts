import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLiveStatus } from './useLiveStatus';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { getLastTelemetryMessageAt } from '../utils/telemetrySocket';
import type { SessionData } from '../types/telemetry';

vi.mock('../utils/telemetrySocket', () => ({
  getLastTelemetryMessageAt: vi.fn(() => 0),
}));

const session = { TrackId: 0, SessionType: 15 } as SessionData;

describe('useLiveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSessionStatusStore.setState({ connected: false, session: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is offline while the feed is not connected', () => {
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe('offline');
  });

  it('is listening when connected but no session has arrived', () => {
    useSessionStatusStore.setState({ connected: true, session: null });
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe('listening');
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
