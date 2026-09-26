import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSharedSocket, createWebSocket, resolveWebSocketUrl } from './websocketClient';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number = 1;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
}

describe('websocketClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves URLs properly for relative paths and absolute URLs', () => {
    expect(resolveWebSocketUrl('ws://example.com/ws')).toBe('ws://example.com/ws');
    expect(resolveWebSocketUrl('wss://example.com/ws')).toBe('wss://example.com/ws');
    expect(resolveWebSocketUrl('http://localhost:8080/ws')).toBe('ws://localhost:8080/ws');
    expect(resolveWebSocketUrl('https://localhost:8080/ws')).toBe('wss://localhost:8080/ws');
    expect(resolveWebSocketUrl('/ws')).toContain('/ws');
  });

  it('connects and receives parsed JSON messages', () => {
    const onMessage = vi.fn();
    const onConnect = vi.fn();
    const client = createWebSocket('/ws', { onMessage, onConnect });

    client.connect();
    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];

    ws.onopen?.();
    expect(onConnect).toHaveBeenCalled();
    expect(client.isConnected()).toBe(true);

    ws.onmessage?.({ data: JSON.stringify({ PacketId: 1, Speed: 320 }) });
    expect(onMessage).toHaveBeenCalledWith({ PacketId: 1, Speed: 320 });
  });

  it('safely handles malformed JSON messages without crashing', () => {
    const onMessage = vi.fn();
    const client = createWebSocket('/ws', { onMessage });

    client.connect();
    const ws = MockWebSocket.instances[0];

    expect(() => {
      ws.onmessage?.({ data: 'invalid JSON data' });
    }).not.toThrow();

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('reconnects with backoff when connection closes unexpectedly', () => {
    const onDisconnect = vi.fn();
    const client = createWebSocket('/ws', { onMessage: vi.fn(), onDisconnect, reconnectMs: 1000 });

    client.connect();
    expect(MockWebSocket.instances.length).toBe(1);
    const ws1 = MockWebSocket.instances[0];

    ws1.close();
    expect(onDisconnect).toHaveBeenCalled();

    // Advance timer to trigger reconnect
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it('does not reconnect when explicitly disconnected', () => {
    const client = createWebSocket('/ws', { onMessage: vi.fn() });
    client.connect();
    expect(MockWebSocket.instances.length).toBe(1);

    client.disconnect();
    expect(client.isConnected()).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(MockWebSocket.instances.length).toBe(1);
  });
});

describe('createSharedSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens one connection for all subscribers and closes it after the last one leaves', () => {
    const shared = createSharedSocket('/ws/test');
    const unsub1 = shared.subscribe();
    const unsub2 = shared.subscribe();
    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];

    unsub1();
    expect(ws.readyState).toBe(MockWebSocket.OPEN);
    unsub2();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);

    // Unsubscribing twice must not close a connection opened by a later subscriber.
    unsub2();
    shared.subscribe();
    unsub1();
    expect(MockWebSocket.instances.length).toBe(2);
    expect(MockWebSocket.instances[1].readyState).toBe(MockWebSocket.OPEN);
  });

  it('delivers each message once per subscription, even when one handler is subscribed twice', () => {
    const onMessage = vi.fn();
    const shared = createSharedSocket('/ws/test', { onMessage });
    const handler = vi.fn();
    const unsubA = shared.subscribe(handler);
    shared.subscribe(handler);

    MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ n: 1 }) });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(2);

    unsubA();
    MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ n: 2 }) });
    expect(handler).toHaveBeenCalledTimes(3);
    expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.OPEN);
  });

  it('logs a handler exception and still delivers the message to the other handlers', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shared = createSharedSocket('/ws/test');
    const failure = new Error('handler blew up');
    shared.subscribe(() => {
      throw failure;
    });
    const healthy = vi.fn();
    shared.subscribe(healthy);

    MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ n: 1 }) });

    expect(healthy).toHaveBeenCalledWith({ n: 1 });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('/ws/test'), failure);
  });

  it('uses the first subscriber URL and warns when a later subscriber asks for another one', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const shared = createSharedSocket('/ws/test');
    const unsub1 = shared.subscribe(undefined, 'ws://first.example/ws/test');
    const unsub2 = shared.subscribe(undefined, 'ws://second.example/ws/test');
    const unsub3 = shared.subscribe();

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://first.example/ws/test');
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('ws://second.example/ws/test'));

    unsub1();
    unsub2();
    unsub3();
    // Once everyone has left, the next first subscriber picks the URL again.
    shared.subscribe(undefined, 'ws://second.example/ws/test');
    expect(MockWebSocket.instances[1].url).toBe('ws://second.example/ws/test');
    expect(consoleWarn).toHaveBeenCalledTimes(1);
  });
});
