import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectTelemetryWebSocket, getTelemetryWebSocketClient } from './telemetrySocket';
import { useTelemetryStore } from '../store/useTelemetryStore';

class MockWS {
  static instances: MockWS[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockWS.instances.push(this);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

describe('telemetrySocket manager', () => {
  beforeEach(() => {
    MockWS.instances = [];
    vi.stubGlobal('WebSocket', MockWS);
    useTelemetryStore.getState().resetSession();
    useTelemetryStore.getState().setConnected(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('connects on first subscriber and disconnects when all unsubscribe', () => {
    const unsub1 = connectTelemetryWebSocket('/ws');
    expect(MockWS.instances.length).toBe(1);
    const ws = MockWS.instances[0];

    // Trigger onopen
    ws.onopen?.();
    expect(useTelemetryStore.getState().connected).toBe(true);

    const unsub2 = connectTelemetryWebSocket('/ws');
    // Re-uses same connection
    expect(MockWS.instances.length).toBe(1);

    // Unsubscribe first
    unsub1();
    expect(useTelemetryStore.getState().connected).toBe(true);
    expect(getTelemetryWebSocketClient()).not.toBeNull();

    // Unsubscribe last
    unsub2();
    expect(useTelemetryStore.getState().connected).toBe(false);
    expect(getTelemetryWebSocketClient()).toBeNull();
  });

  it('processes incoming messages into telemetry store', () => {
    const unsub = connectTelemetryWebSocket('/ws');
    const ws = MockWS.instances[0];
    ws.onopen?.();

    const mockEvent = {
      Header: {
        PacketId: 3,
        SessionTime: 123.45,
      },
      EventCode: 'RDFL',
    };

    ws.onmessage?.({ data: JSON.stringify(mockEvent) });
    expect(useTelemetryStore.getState().events.length).toBe(1);
    expect(useTelemetryStore.getState().events[0].eventCode).toBe('RDFL');

    unsub();
  });
});
