import { createSharedSocket } from './websocketClient';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSessionStatusStore } from '../store/useSessionStatusStore';

// Kept outside the stores so a 10Hz feed doesn't re-render their subscribers
let lastMessageAt = 0;

/**
 * Returns when the last live telemetry message arrived (epoch ms), or 0 if none has yet.
 */
export function getLastTelemetryMessageAt(): number {
  return lastMessageAt;
}

const telemetrySocket = createSharedSocket('/ws', {
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

/**
 * Subscribes a consumer to the consolidated Live Telemetry /ws WebSocket connection.
 * Connects automatically when the first subscriber registers and disconnects when all unsubscribe.
 * Only the first subscriber's `wsUrl` is used; see `SharedSocket.subscribe`.
 */
export function connectTelemetryWebSocket(wsUrl?: string): () => void {
  return telemetrySocket.subscribe(undefined, wsUrl);
}
