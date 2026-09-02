import { createWebSocket, type WebSocketClient } from './websocketClient';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';

let activeWsClient: WebSocketClient | null = null;
let wsSubscribers = 0;

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
