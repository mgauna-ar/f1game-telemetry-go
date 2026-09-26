import { createWebSocket, type WebSocketClient } from './websocketClient';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';

let activeWsClient: WebSocketClient | null = null;
let wsSubscribers = 0;
// Kept outside the stores so a 10Hz feed doesn't re-render their subscribers
let lastMessageAt = 0;

/**
 * Returns when the last live telemetry message arrived (epoch ms), or 0 if none has yet.
 */
export function getLastTelemetryMessageAt(): number {
  return lastMessageAt;
}

/**
 * Returns the current active WebSocket client instance (if connected/instantiated).
 */
export function getTelemetryWebSocketClient(): WebSocketClient | null {
  return activeWsClient;
}

/**
 * Subscribes a consumer to the consolidated Live Telemetry /ws WebSocket connection.
 * Connects automatically when the first subscriber registers and disconnects when all unsubscribe.
 */
export function connectTelemetryWebSocket(wsUrl?: string): () => void {
  wsSubscribers++;

  if (!activeWsClient) {
    activeWsClient = createWebSocket(wsUrl || '/ws', {
      onConnect: () => {
        useSessionStatusStore.getState().setConnected(true);
      },
      onDisconnect: () => {
        useSessionStatusStore.getState().setConnected(false);
      },
      onMessage: (data) => {
        lastMessageAt = Date.now();
        useTelemetryStore.getState().processIncomingMessage(data);
      },
    });
  }

  if (!activeWsClient.isConnected()) {
    activeWsClient.connect();
  }

  return () => {
    wsSubscribers = Math.max(0, wsSubscribers - 1);
    if (wsSubscribers === 0 && activeWsClient) {
      activeWsClient.disconnect();
      activeWsClient = null;
      useSessionStatusStore.getState().setConnected(false);
    }
  };
}
