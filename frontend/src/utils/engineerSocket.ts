import type { EngineerSocketMessage } from '../types/telemetry';
import { createSharedSocket } from './websocketClient';

const engineerSocket = createSharedSocket('/ws/engineer');

type EngineerMessageType = EngineerSocketMessage['type'];

/** One optional handler per /ws/engineer message type, each receiving that message's type. */
export type EngineerMessageHandlers = {
  [K in EngineerMessageType]?: (msg: Extract<EngineerSocketMessage, { type: K }>) => void;
};

// tsc fails here when the generated union gains or loses a message type.
const ENGINEER_MESSAGE_TYPES = {
  directive: true,
  ptt_event: true,
  ptt_learned: true,
  ptt_learn_timeout: true,
  settings_changed: true,
} as const satisfies Record<EngineerMessageType, true>;

function isEngineerSocketMessage(data: unknown): data is EngineerSocketMessage {
  if (typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: unknown }).type;
  return typeof type === 'string' && Object.hasOwn(ENGINEER_MESSAGE_TYPES, type);
}

/**
 * Routes one decoded /ws/engineer frame to the handler for its `type`. Frames that aren't a known
 * engineer message are dropped.
 */
export function dispatchEngineerMessage(data: unknown, handlers: EngineerMessageHandlers): void {
  if (!isEngineerSocketMessage(data)) return;
  const handler = handlers[data.type] as ((msg: EngineerSocketMessage) => void) | undefined;
  handler?.(data);
}

/**
 * Subscribes typed handlers to the singleton /ws/engineer WebSocket connection. Connects when the
 * first subscriber registers and disconnects when all unsubscribe. Only the first subscriber's
 * `customUrl` is used; see `SharedSocket.subscribe`.
 */
export function subscribeEngineerMessages(handlers: EngineerMessageHandlers, customUrl?: string): () => void {
  return engineerSocket.subscribe((data) => dispatchEngineerMessage(data, handlers), customUrl);
}
