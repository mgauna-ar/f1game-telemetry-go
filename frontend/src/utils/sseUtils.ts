/**
 * The AI chat stream contract (`POST /api/ai/chat`, written by `internal/ai/sse.go`):
 * - `data: {"text": "..."}` carries the next piece of the reply.
 * - `data: {"error", "code", "provider", "message"}` ends the stream with a failure.
 * - `data: [DONE]` marks a finished reply, but a stream may also just end.
 * A request the server rejects before streaming gets a non-OK response with the same error fields as JSON.
 */

import { AI_ERROR_CODES } from '../constants/f1';
import type { AIErrorPayload } from '../types/generated/ai';

const SSE_DATA_PREFIX = 'data:';
const SSE_DONE_MESSAGE = '[DONE]';

type ChatErrorBody = Partial<AIErrorPayload>;

interface ChatStreamFrame extends ChatErrorBody {
  text?: string;
}

/** An AI chat failure reported by the server, with its classified code (e.g. `QUOTA_EXCEEDED`). */
export class ChatStreamError extends Error {
  readonly code: string;
  readonly provider?: string;

  constructor(message: string, code: string, provider?: string) {
    super(message);
    this.name = 'ChatStreamError';
    this.code = code;
    this.provider = provider;
    Object.setPrototypeOf(this, ChatStreamError.prototype);
  }
}

const errorFromBody = (body: ChatErrorBody, fallbackMessage: string): ChatStreamError =>
  new ChatStreamError(body.message || body.error || fallbackMessage, body.code || AI_ERROR_CODES.GENERIC_ERROR, body.provider);

/** Builds the error for a chat request the server answered with a non-OK status. */
export async function chatStreamErrorFromResponse(res: Response): Promise<ChatStreamError> {
  const fallback = `Server responded with status ${res.status}`;
  const raw = (await res.text().catch(() => '')).trim();
  try {
    const body = JSON.parse(raw) as ChatErrorBody;
    if (body && typeof body === 'object') return errorFromBody(body, fallback);
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return new ChatStreamError(raw || fallback, AI_ERROR_CODES.GENERIC_ERROR);
}

/** Parses one SSE line. Returns the text it carries, or throws when it is an error frame. */
function readLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith(SSE_DATA_PREFIX)) return '';
  const payload = trimmed.slice(SSE_DATA_PREFIX.length).trim();
  if (!payload || payload === SSE_DONE_MESSAGE) return '';

  let frame: ChatStreamFrame;
  try {
    frame = JSON.parse(payload) as ChatStreamFrame;
  } catch {
    return '';
  }
  if (frame.error) throw errorFromBody(frame, frame.error);
  return typeof frame.text === 'string' ? frame.text : '';
}

/**
 * Reads the AI chat stream, calling onText with each piece of the reply as it arrives, and
 * returns the whole reply. Throws a ChatStreamError when the server sends an error frame.
 */
export async function readChatStream(response: Response, onText: (text: string) => void): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder('utf-8');
  let reply = '';
  let buffer = '';
  const consume = (line: string) => {
    const text = readLine(line);
    if (text) {
      reply += text;
      onText(text);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(consume);
    }
    consume(buffer + decoder.decode());
  } finally {
    reader.releaseLock();
  }

  return reply;
}
