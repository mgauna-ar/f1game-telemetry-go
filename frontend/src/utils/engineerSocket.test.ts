import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeEngineerWebSocket } from './engineerSocket';

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

describe('engineerSocket singleton', () => {
  beforeEach(() => {
    MockWS.instances = [];
    vi.stubGlobal('WebSocket', MockWS);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connects when first subscriber registers and disconnects when all unsubscribe', () => {
    const handler1 = vi.fn();
    const unsub1 = subscribeEngineerWebSocket(handler1);

    expect(MockWS.instances.length).toBe(1);
    const ws = MockWS.instances[0];

    const handler2 = vi.fn();
    const unsub2 = subscribeEngineerWebSocket(handler2);

    // Should share the same connection without creating a second WebSocket
    expect(MockWS.instances.length).toBe(1);

    // Broadcast message
    ws.onmessage?.({ data: JSON.stringify({ type: 'ptt_event', state: 'down' }) });
    expect(handler1).toHaveBeenCalledWith({ type: 'ptt_event', state: 'down' });
    expect(handler2).toHaveBeenCalledWith({ type: 'ptt_event', state: 'down' });

    // Unsubscribe first
    unsub1();
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Unsubscribe second (all subscribers gone)
    unsub2();
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('safely handles non-JSON messages without crashing subscribers', () => {
    const handler = vi.fn();
    const unsub = subscribeEngineerWebSocket(handler);

    const ws = MockWS.instances[MockWS.instances.length - 1];
    ws.onmessage?.({ data: 'invalid JSON string' });

    expect(handler).not.toHaveBeenCalled();
    unsub();
  });
});
