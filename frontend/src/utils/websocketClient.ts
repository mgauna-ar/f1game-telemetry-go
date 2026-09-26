/**
 * Unified, robust WebSocket factory client for telemetry and AI engineer streaming.
 */

export interface WebSocketClientOptions {
  onMessage: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectMs?: number;      // Initial backoff (default 2000)
  maxReconnectMs?: number;   // Cap backoff (default 30000)
  autoReconnect?: boolean;   // Default true
}

export interface WebSocketClient {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

export function resolveWebSocketUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('ws://') || pathOrUrl.startsWith('wss://')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('http://')) {
    return 'ws://' + pathOrUrl.slice('http://'.length);
  }
  if (pathOrUrl.startsWith('https://')) {
    return 'wss://' + pathOrUrl.slice('https://'.length);
  }

  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  if (typeof window === 'undefined') {
    return `ws://localhost:8080${cleanPath}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}

export function createWebSocket(pathOrUrl: string, options: WebSocketClientOptions): WebSocketClient {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectMs = 2000,
    maxReconnectMs = 30000,
    autoReconnect = true,
  } = options;

  let activeSocket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isExplicitlyClosed = false;
  let currentBackoffMs = reconnectMs;

  const clearTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (isExplicitlyClosed || !autoReconnect || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      currentBackoffMs = Math.min(currentBackoffMs * 1.5, maxReconnectMs);
      connect();
    }, currentBackoffMs);
  };

  const connect = () => {
    isExplicitlyClosed = false;
    clearTimer();

    if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) {
      return;
    }

    try {
      const url = resolveWebSocketUrl(pathOrUrl);
      const socket = new WebSocket(url);
      activeSocket = socket;

      socket.onopen = () => {
        currentBackoffMs = reconnectMs;
        onConnect?.();
      };

      socket.onclose = () => {
        activeSocket = null;
        onDisconnect?.();
        if (!isExplicitlyClosed) {
          scheduleReconnect();
        }
      };

      socket.onerror = (evt) => {
        onError?.(evt);
      };

      socket.onmessage = (event) => {
        let data: unknown;
        try {
          data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch {
          // Malformed JSON frames are dropped
          return;
        }
        onMessage(data);
      };
    } catch {
      activeSocket = null;
      if (!isExplicitlyClosed) {
        scheduleReconnect();
      }
    }
  };

  const disconnect = () => {
    isExplicitlyClosed = true;
    clearTimer();

    if (activeSocket) {
      const ws = activeSocket;
      activeSocket = null;
      ws.onclose = null;
      ws.close();
      onDisconnect?.();
    }
  };

  const isConnected = () => {
    return activeSocket !== null && activeSocket.readyState === WebSocket.OPEN;
  };

  return {
    connect,
    disconnect,
    isConnected,
  };
}

export type SocketMessageHandler = (data: unknown) => void;

export interface SharedSocketOptions {
  /** Runs once per message, before the subscribers' handlers. */
  onMessage?: SocketMessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface SharedSocket {
  /**
   * Adds a subscriber and returns its unsubscribe function. The connection opens with the first
   * subscriber and closes when the last one leaves.
   *
   * Only the first subscriber's `url` counts: later subscribers share the open connection, and one
   * passing a different URL gets a console warning. After everyone has left, the next first
   * subscriber picks the URL again.
   */
  subscribe: (handler?: SocketMessageHandler, url?: string) => () => void;
}

/**
 * A ref-counted WebSocket connection shared by every subscriber of one endpoint. Each message goes
 * to `options.onMessage` and then to every subscriber's handler; a handler that throws is logged
 * and does not stop the others.
 */
export function createSharedSocket(defaultPath: string, options: SharedSocketOptions = {}): SharedSocket {
  // One entry per subscription, so the same handler subscribed twice is counted and called twice.
  const subscriptions = new Set<{ handler?: SocketMessageHandler }>();
  let client: WebSocketClient | null = null;
  let activeUrl = defaultPath;

  const dispatch = (data: unknown) => {
    const run = (handler: SocketMessageHandler) => {
      try {
        handler(data);
      } catch (err) {
        console.error(`WebSocket ${activeUrl} message handler failed`, err);
      }
    };
    if (options.onMessage) run(options.onMessage);
    subscriptions.forEach(({ handler }) => {
      if (handler) run(handler);
    });
  };

  const subscribe = (handler?: SocketMessageHandler, url?: string) => {
    if (!client) {
      activeUrl = url || defaultPath;
      client = createWebSocket(activeUrl, {
        onMessage: dispatch,
        onConnect: options.onConnect,
        onDisconnect: options.onDisconnect,
      });
    } else if (url && url !== activeUrl) {
      console.warn(`WebSocket ${url} ignored: this page already shares a connection to ${activeUrl}`);
    }

    const subscription = { handler };
    subscriptions.add(subscription);
    if (!client.isConnected()) {
      client.connect();
    }

    return () => {
      if (!subscriptions.delete(subscription)) return;
      if (subscriptions.size === 0 && client) {
        client.disconnect();
        client = null;
      }
    };
  };

  return { subscribe };
}
