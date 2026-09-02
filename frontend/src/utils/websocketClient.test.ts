import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebSocket, resolveWebSocketUrl } from './websocketClient';

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
  sentData: string[] = [];

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentData.push(data);
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

  it('sends data when socket is open', () => {
    const client = createWebSocket('/ws', { onMessage: vi.fn() });
    client.connect();
    const ws = MockWebSocket.instances[0];

    client.send({ command: 'ping' });
    expect(ws.sentData).toContain(JSON.stringify({ command: 'ping' }));

    client.send('raw-string');
    expect(ws.sentData).toContain('raw-string');
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
