import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStatusStore } from './useSessionStatusStore';
import type { SessionData } from '../types/telemetry';

describe('useSessionStatusStore', () => {
  beforeEach(() => {
    useSessionStatusStore.getState().resetSession();
  });

  it('initializes with default status values', () => {
    const state = useSessionStatusStore.getState();
    expect(state.session).toBeNull();
    expect(state.participants).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.packetFormat).toBeNull();
    expect(state.connected).toBe(false);
  });

  it('updates connection state', () => {
    useSessionStatusStore.getState().setConnected(true);
    expect(useSessionStatusStore.getState().connected).toBe(true);
  });

  it('handles events queue correctly', () => {
    useSessionStatusStore.getState().addEvent({
      eventCode: 'FTLP',
      type: 'fastest_lap',
      description: 'Fastest lap set',
      severity: 'purple',
    });

    const state = useSessionStatusStore.getState();
    expect(state.events.length).toBe(1);
    expect(state.events[0].description).toBe('Fastest lap set');

    useSessionStatusStore.getState().clearEvents();
    expect(useSessionStatusStore.getState().events.length).toBe(0);
  });

  it('sets partial session status and resets cleanly', () => {
    useSessionStatusStore.getState().setSessionStatus({
      session: { TrackId: 3, TotalLaps: 50 } as unknown as SessionData,
      packetFormat: 2026,
    });

    expect(useSessionStatusStore.getState().session?.TrackId).toBe(3);
    expect(useSessionStatusStore.getState().packetFormat).toBe(2026);

    useSessionStatusStore.getState().resetSession();
    expect(useSessionStatusStore.getState().session).toBeNull();
  });
});
