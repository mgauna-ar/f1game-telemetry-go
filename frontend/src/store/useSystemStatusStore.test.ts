import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { liveStatusFromSystem, subscribeSystemStatus, useSystemStatusStore } from './useSystemStatusStore';
import type { SystemStatus } from '../types/system';

const session = { session_uid: '0x01', session_type: 15, track_id: 0, packet_format: 2025, player_car_index: 0 };
const status = (packetAge: number | null, withSession = true): SystemStatus => ({
  udp_addr: '0.0.0.0:20777',
  udp_port: 20777,
  packet_age_ms: packetAge,
  session: withSession ? session : null,
});

describe('liveStatusFromSystem', () => {
  it('reads the feed state from the packet age', () => {
    expect(liveStatusFromSystem(null)).toBe('offline');
    expect(liveStatusFromSystem(status(null, false))).toBe('listening');
    expect(liveStatusFromSystem(status(200, false))).toBe('listening');
    expect(liveStatusFromSystem(status(200))).toBe('live');
    expect(liveStatusFromSystem(status(5_000))).toBe('stale');
    // A session that ended long ago is no longer news
    expect(liveStatusFromSystem(status(120_000))).toBe('listening');
  });
});

describe('subscribeSystemStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSystemStatusStore.setState({ liveStatus: 'offline', session: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls while someone is subscribed and keeps the session only while it is live or stale', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockClear();
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => status(100) } as Response)
    );

    const stopA = subscribeSystemStatus();
    const stopB = subscribeSystemStatus();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/system/status');
    expect(useSystemStatusStore.getState()).toMatchObject({ liveStatus: 'live', session });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The server goes away: offline, no session
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(useSystemStatusStore.getState()).toMatchObject({ liveStatus: 'offline', session: null });

    stopA();
    stopB();
    stopB(); // a second call is harmless
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
