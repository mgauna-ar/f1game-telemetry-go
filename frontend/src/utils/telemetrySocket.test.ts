import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connectTelemetryWebSocket } from './telemetrySocket';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';

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
    useSessionStatusStore.getState().setConnected(false);
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
    expect(useSessionStatusStore.getState().connected).toBe(true);

    const unsub2 = connectTelemetryWebSocket('/ws');
    // Re-uses same connection
    expect(MockWS.instances.length).toBe(1);

    // Unsubscribe first
    unsub1();
    expect(useSessionStatusStore.getState().connected).toBe(true);
    expect(ws.readyState).toBe(MockWS.OPEN);

    // Unsubscribe last
    unsub2();
    expect(useSessionStatusStore.getState().connected).toBe(false);
    expect(ws.readyState).toBe(MockWS.CLOSED);

    // The next subscriber opens a fresh connection
    const unsub3 = connectTelemetryWebSocket();
    expect(MockWS.instances.length).toBe(2);
    unsub3();
  });

  it('processes each message once no matter how many consumers subscribe', () => {
    const processIncomingMessage = vi.spyOn(useTelemetryStore.getState(), 'processIncomingMessage');
    const unsub1 = connectTelemetryWebSocket();
    const unsub2 = connectTelemetryWebSocket();
    MockWS.instances[0].onmessage?.({ data: JSON.stringify({ Header: { PacketId: 255 }, Events: [] }) });

    expect(processIncomingMessage).toHaveBeenCalledTimes(1);
    unsub1();
    unsub2();
    processIncomingMessage.mockRestore();
  });

  it('processes incoming messages into telemetry store', () => {
    const unsub = connectTelemetryWebSocket('/ws');
    const ws = MockWS.instances[0];
    ws.onopen?.();

    const snapshot = {
      Header: {
        PacketId: 255,
        SessionTime: 123.45,
      },
      Events: [{ eventCode: 'RDFL', type: 'flag', severity: 'danger', sessionTime: 123.45 }],
    };

    ws.onmessage?.({ data: JSON.stringify(snapshot) });
    expect(useSessionStatusStore.getState().events.length).toBe(1);
    expect(useSessionStatusStore.getState().events[0].eventCode).toBe('RDFL');

    unsub();
  });
});
