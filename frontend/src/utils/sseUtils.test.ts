import { describe, it, expect, vi } from 'vitest';
import { ChatStreamError, chatStreamErrorFromResponse, readChatStream } from './sseUtils';

function createMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream);
}

describe('readChatStream', () => {
  it('handles an empty response body gracefully', async () => {
    const result = await readChatStream(new Response(null), vi.fn());
    expect(result).toBe('');
  });

  it('passes each text chunk to onText and returns the whole reply', async () => {
    const onText = vi.fn();
    const result = await readChatStream(
      createMockResponse(['data: {"text":"Hello "}\n\n', 'data: {"text":"world"}\n\n', 'data: [DONE]\n\n']),
      onText
    );
    expect(result).toBe('Hello world');
    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenNthCalledWith(1, 'Hello ');
    expect(onText).toHaveBeenNthCalledWith(2, 'world');
  });

  it('joins frames split across network chunks', async () => {
    const onText = vi.fn();
    const result = await readChatStream(
      createMockResponse(['data: {"te', 'xt":"Box this ', 'lap"}\n', '\ndata: {"text":" for softs"}\n\n']),
      onText
    );
    expect(result).toBe('Box this lap for softs');
    expect(onText).toHaveBeenCalledTimes(2);
  });

  it('reads a final frame that has no trailing newline', async () => {
    const result = await readChatStream(createMockResponse(['data: {"text":"Copy."}']), vi.fn());
    expect(result).toBe('Copy.');
  });

  it('ignores [DONE] and does not require it', async () => {
    const onText = vi.fn();
    expect(await readChatStream(createMockResponse(['data: [DONE]\n\n']), onText)).toBe('');
    expect(await readChatStream(createMockResponse(['data: {"text":"Copy."}\n\n']), onText)).toBe('Copy.');
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('only reads the text field', async () => {
    const result = await readChatStream(
      createMockResponse(['data: {"content":"old"}\n\n', 'data: {"delta":{"content":"openai"}}\n\n', 'data: {"text":"ok"}\n\n']),
      vi.fn()
    );
    expect(result).toBe('ok');
  });

  it('throws a ChatStreamError with the code of an error frame', async () => {
    const onText = vi.fn();
    const stream = createMockResponse([
      'data: {"text":"Box "}\n\n',
      'data: {"error":"upstream 429","code":"QUOTA_EXCEEDED","provider":"gemini","message":"Quota exceeded."}\n\n',
      'data: {"text":"never read"}\n\n',
    ]);

    const err = await readChatStream(stream, onText).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ChatStreamError);
    expect(err).toMatchObject({ name: 'ChatStreamError', code: 'QUOTA_EXCEEDED', provider: 'gemini', message: 'Quota exceeded.' });
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('falls back to the raw error and a generic code when the frame has no message or code', async () => {
    const err = await readChatStream(createMockResponse(['data: {"error":"boom"}\n\n']), vi.fn()).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'GENERIC_ERROR', message: 'boom', provider: undefined });
  });
});

describe('chatStreamErrorFromResponse', () => {
  it('builds the error from a JSON error body', async () => {
    const res = new Response(
      JSON.stringify({ error: 'raw', code: 'MODEL_OVERLOADED', provider: 'openai', message: 'Overloaded.' }),
      { status: 503 }
    );
    const err = await chatStreamErrorFromResponse(res);
    expect(err).toBeInstanceOf(ChatStreamError);
    expect(err).toMatchObject({ code: 'MODEL_OVERLOADED', provider: 'openai', message: 'Overloaded.' });
  });

  it('uses the error field when there is no message', async () => {
    const res = new Response(JSON.stringify({ error: 'invalid request payload', code: 'INVALID_REQUEST' }), { status: 400 });
    expect(await chatStreamErrorFromResponse(res)).toMatchObject({ code: 'INVALID_REQUEST', message: 'invalid request payload' });
  });

  it('falls back to the body text or status when the body is not JSON', async () => {
    expect(await chatStreamErrorFromResponse(new Response('Bad gateway', { status: 502 }))).toMatchObject({
      code: 'GENERIC_ERROR',
      message: 'Bad gateway',
    });
    expect(await chatStreamErrorFromResponse(new Response('', { status: 500 }))).toMatchObject({
      code: 'GENERIC_ERROR',
      message: 'Server responded with status 500',
    });
  });
});
