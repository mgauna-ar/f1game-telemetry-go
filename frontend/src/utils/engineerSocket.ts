import { createWebSocket, type WebSocketClient } from './websocketClient';

type EngineerMessageHandler = (data: any) => void;

let activeClient: WebSocketClient | null = null;
let engineerSubscribers = 0;
const handlers = new Set<EngineerMessageHandler>();

function getOrCreateClient(customUrl?: string): WebSocketClient {
  if (!activeClient) {
    activeClient = createWebSocket(customUrl || '/ws/engineer', {
      onMessage: (data) => {
        handlers.forEach((handler) => {
          try {
            handler(data);
          } catch {
            // Silently suppress handler execution exceptions to avoid crashing subscribers
          }
        });
      },
    });
  }
  return activeClient;
}

/**
 * Subscribes a message listener to the singleton /ws/engineer WebSocket connection.
 * Connects automatically when the first subscriber registers and disconnects when all unsubscribe.
 */
export function subscribeEngineerWebSocket(handler: EngineerMessageHandler, customUrl?: string): () => void {
  handlers.add(handler);
  engineerSubscribers++;

  const client = getOrCreateClient(customUrl);
  if (!client.isConnected()) {
    client.connect();
  }

  return () => {
    handlers.delete(handler);
    engineerSubscribers = Math.max(0, engineerSubscribers - 1);
    if (engineerSubscribers === 0 && activeClient) {
      activeClient.disconnect();
      activeClient = null;
    }
  };
}
