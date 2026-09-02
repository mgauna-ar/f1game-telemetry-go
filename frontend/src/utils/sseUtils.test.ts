import { describe, it, expect, vi } from 'vitest';
import { readSSEStream } from './sseUtils';

describe('readSSEStream', () => {
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

  it('handles empty response body gracefully', async () => {
    const res = new Response(null);
    const result = await readSSEStream(res);
    expect(result).toBe('');
  });

  it('reads and parses JSON SSE chunks properly', async () => {
    const chunks = [
      'data: {"text":"Hello "}\n\n',
      'data: {"text":"world"}\n\n',
      'data: [DONE]\n\n',
    ];
    const res = createMockResponse(chunks);
    const onChunk = vi.fn();

    const result = await readSSEStream(res, onChunk);
    expect(result).toBe('Hello world');
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello ');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'world');
  });

  it('handles chunks split across network buffer boundaries', async () => {
    const chunks = [
      'data: {"content":',
      '"Box this ',
      'lap"}\n',
      'data: {"content":" for softs"}\n',
    ];
    const res = createMockResponse(chunks);
    const onChunk = vi.fn();

    const result = await readSSEStream(res, onChunk);
    expect(result).toBe('Box this lap for softs');
  });

  it('handles raw non-JSON SSE data', async () => {
    const chunks = [
      'data: Affirmative\n',
      'data: [DONE]\n',
    ];
    const res = createMockResponse(chunks);
    const result = await readSSEStream(res);
    expect(result).toBe('Affirmative');
  });
});
