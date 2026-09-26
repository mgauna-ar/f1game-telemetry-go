import { createSharedSocket, type SocketMessageHandler } from './websocketClient';

const engineerSocket = createSharedSocket('/ws/engineer');

/**
 * Subscribes a message listener to the singleton /ws/engineer WebSocket connection.
 * Connects automatically when the first subscriber registers and disconnects when all unsubscribe.
 * Only the first subscriber's `customUrl` is used; see `SharedSocket.subscribe`.
 */
export function subscribeEngineerWebSocket(handler: SocketMessageHandler, customUrl?: string): () => void {
  return engineerSocket.subscribe(handler, customUrl);
}
