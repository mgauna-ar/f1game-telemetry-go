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
  send: (data: unknown) => void;
  isConnected: () => boolean;
  getSocket: () => WebSocket | null;
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
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          onMessage(data);
        } catch {
          // Safe failover for malformed JSON frames
        }
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

  const send = (data: unknown) => {
    if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    activeSocket.send(message);
  };

  const isConnected = () => {
    return activeSocket !== null && activeSocket.readyState === WebSocket.OPEN;
  };

  const getSocket = () => activeSocket;

  return {
    connect,
    disconnect,
    send,
    isConnected,
    getSocket,
  };
}
