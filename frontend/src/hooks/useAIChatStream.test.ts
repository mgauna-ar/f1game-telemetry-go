import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIChatStream } from './useAIChatStream';
import { api } from '../utils/apiClient';
import { NO_AI_KEYS, type AIConfig, type AIKeyStatusByProvider } from '../context/RaceEngineerContext';

function createMockSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('useAIChatStream Hook', () => {
  const defaultConfig: AIConfig = {
    provider: 'gemini',
    model: 'gemini-flash-lite-latest',
    baseUrl: '',
    providerModels: { gemini: 'gemini-flash-lite-latest', openai: '', claude: '', custom: '' },
  };

  const geminiKeySaved: AIKeyStatusByProvider = {
    ...NO_AI_KEYS,
    gemini: { hasSavedKey: true, hasEnvKey: false },
  };

  const defaultProps = {
    config: defaultConfig,
    keyStatus: geminiKeySaved,
    buildChatContext: () => ({ context_mode: 'comparator' as const, lap_a_id: 11, lap_b_id: 12 }),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with a welcome assistant message', () => {
    const { result } = renderHook(() => useAIChatStream(defaultProps));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('welcome');
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.isGenerating).toBe(false);
  });

  it('sets MISSING_API_KEY error card when no API key is available', async () => {
    const noKeyProps = {
      ...defaultProps,
      keyStatus: NO_AI_KEYS,
    };

    const { result } = renderHook(() => useAIChatStream(noKeyProps));

    await act(async () => {
      await result.current.sendMessage('Analyze my braking');
    });

    expect(result.current.messages).toHaveLength(3); // welcome, user, assistant error
    const assistantMsg = result.current.messages[2];
    expect(assistantMsg.errorCode).toBe('MISSING_API_KEY');
    expect(assistantMsg.canRetry).toBe(false);
  });

  it('streams response chunks and updates assistant message content', async () => {
    const mockSSE = createMockSSEResponse([
      'data: {"text":"Brake 10m earlier "}\n\n',
      'data: {"text":"into Turn 1."}\n\n',
      'data: [DONE]\n\n',
    ]);

    const streamSpy = vi.spyOn(api, 'stream').mockResolvedValueOnce(mockSSE);

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Where to brake?');
    });

    expect(streamSpy).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-flash-lite-latest',
        persona: expect.any(String),
        language: 'en',
        // Only identifiers: the server builds the comparison from the lap IDs.
        context: { context_mode: 'comparator', lap_a_id: 11, lap_b_id: 12 },
      }),
      expect.any(AbortSignal)
    );
    // The key stays on the server; the browser never sends one.
    expect(streamSpy.mock.calls[0][1]).not.toHaveProperty('api_key');
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[1].content).toBe('Where to brake?');
    expect(result.current.messages[2].content).toBe('Brake 10m earlier into Turn 1.');
    expect(result.current.messages[2].errorCode).toBeUndefined();
  });

  it('handles structured server error and sets appropriate error code', async () => {
    const errorResponse = new Response(
      JSON.stringify({
        error: 'Model is currently overloaded',
        code: 'MODEL_OVERLOADED',
        provider: 'gemini',
      }),
      { status: 503 }
    );

    vi.spyOn(api, 'stream').mockResolvedValueOnce(errorResponse);

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Strategy update?');
    });

    const assistantMsg = result.current.messages[2];
    expect(assistantMsg.errorCode).toBe('MODEL_OVERLOADED');
    expect(assistantMsg.canRetry).toBe(true);
  });

  it('shows the error frame the server sends mid-stream with its code', async () => {
    vi.spyOn(api, 'stream').mockResolvedValueOnce(
      createMockSSEResponse([
        'data: {"text":"Partial "}\n\n',
        'data: {"error":"401 from upstream","code":"INVALID_API_KEY","provider":"openai","message":"The API key is invalid."}\n\n',
      ])
    );

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Strategy update?');
    });

    const assistantMsg = result.current.messages[2];
    expect(assistantMsg.content).toBe('');
    expect(assistantMsg.errorCode).toBe('INVALID_API_KEY');
    expect(assistantMsg.errorProvider).toBe('openai');
    expect(assistantMsg.errorRaw).toBe('The API key is invalid.');
    expect(assistantMsg.canRetry).toBe(false);
  });

  it('keeps the server code instead of guessing one from the message', async () => {
    vi.spyOn(api, 'stream').mockResolvedValueOnce(
      createMockSSEResponse(['data: {"error":"model not found, quota 429","code":"GENERIC_ERROR"}\n\n'])
    );

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Strategy update?');
    });

    expect(result.current.messages[2].errorCode).toBe('GENERIC_ERROR');
    expect(result.current.messages[2].errorProvider).toBe('gemini');
  });

  it('marks a failed fetch as a network error', async () => {
    vi.spyOn(api, 'stream').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Strategy update?');
    });

    const assistantMsg = result.current.messages[2];
    expect(assistantMsg.errorCode).toBe('NETWORK_ERROR');
    expect(assistantMsg.errorRaw).toBe('Failed to fetch');
    expect(assistantMsg.canRetry).toBe(true);
  });

  it('reports an empty reply as a retryable error', async () => {
    vi.spyOn(api, 'stream').mockResolvedValueOnce(createMockSSEResponse(['data: [DONE]\n\n']));

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Strategy update?');
    });

    const assistantMsg = result.current.messages[2];
    expect(assistantMsg.errorCode).toBe('GENERIC_ERROR');
    expect(assistantMsg.errorRaw).toContain('Received empty response');
    expect(assistantMsg.canRetry).toBe(true);
  });

  it('notes a stopped answer after the text already received', async () => {
    const encoder = new TextEncoder();
    vi.spyOn(api, 'stream').mockImplementation(async (_url, _body, optionsOrSignal) => {
      const signal = optionsOrSignal as AbortSignal;
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"text":"Brake later"}\n\n'));
          signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return new Response(body, { status: 200 });
    });

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.sendMessage('Long query');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      result.current.stopGenerating();
      await pending;
    });

    expect(result.current.messages[2].content).toBe('Brake later\n\n*(Analysis stopped by user)*');
    expect(result.current.messages[2].errorCode).toBeUndefined();
  });

  it('clears messages and resets with welcome banner', () => {
    const { result } = renderHook(() => useAIChatStream(defaultProps));

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toContain('Session history cleared');
  });

  it('retries last user message', async () => {
    const mockSSE1 = createMockSSEResponse(['data: {"text":"First response"}\n\n']);
    const mockSSE2 = createMockSSEResponse(['data: {"text":"Retried response"}\n\n']);

    vi.spyOn(api, 'stream')
      .mockResolvedValueOnce(mockSSE1)
      .mockResolvedValueOnce(mockSSE2);

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('First prompt');
    });

    expect(result.current.messages[2].content).toBe('First response');

    await act(async () => {
      await result.current.retryLastMessage();
    });

    // Should replace assistant message with retried response
    const lastMsg = result.current.messages[result.current.messages.length - 1];
    expect(lastMsg.content).toBe('Retried response');
  });

  it('stops generating on user cancellation', async () => {
    let abortCalled = false;
    vi.spyOn(api, 'stream').mockImplementation((_url, _body, optionsOrSignal) => {
      const signal =
        optionsOrSignal instanceof AbortSignal
          ? optionsOrSignal
          : optionsOrSignal?.signal;
      signal?.addEventListener('abort', () => {
        abortCalled = true;
      });
      return new Promise(() => {}); // never resolves
    });

    const { result } = renderHook(() => useAIChatStream(defaultProps));

    act(() => {
      void result.current.sendMessage('Long query');
    });

    expect(result.current.isGenerating).toBe(true);

    act(() => {
      result.current.stopGenerating();
    });

    expect(abortCalled).toBe(true);
    expect(result.current.isGenerating).toBe(false);
  });

  it('keeps its callbacks while replies stream and props change', async () => {
    vi.spyOn(api, 'stream').mockResolvedValueOnce(
      createMockSSEResponse(['data: {"text":"One "}\n\n', 'data: {"text":"two "}\n\n', 'data: {"text":"three."}\n\n'])
    );

    const { result, rerender } = renderHook((props: typeof defaultProps) => useAIChatStream(props), {
      initialProps: defaultProps,
    });
    const first = { ...result.current };

    await act(async () => {
      await result.current.sendMessage('Count');
    });
    rerender({ ...defaultProps, config: { ...defaultConfig, model: 'another-model' } });

    expect(result.current.messages[2].content).toBe('One two three.');
    expect(result.current.sendMessage).toBe(first.sendMessage);
    expect(result.current.retryLastMessage).toBe(first.retryLastMessage);
    expect(result.current.stopGenerating).toBe(first.stopGenerating);
    expect(result.current.clearMessages).toBe(first.clearMessages);
  });

  it('reads the latest settings and context when sending', async () => {
    const streamSpy = vi.spyOn(api, 'stream').mockResolvedValueOnce(createMockSSEResponse(['data: {"text":"Ok"}\n\n']));
    const { result, rerender } = renderHook((props: typeof defaultProps) => useAIChatStream(props), {
      initialProps: defaultProps,
    });

    rerender({
      ...defaultProps,
      config: { ...defaultConfig, model: 'gemini-pro-latest' },
      buildChatContext: () => ({ context_mode: 'session_debrief' as const, session_id: 7 }) as never,
    });
    await act(async () => {
      await result.current.sendMessage('Debrief');
    });

    expect(streamSpy.mock.calls[0][1]).toMatchObject({
      model: 'gemini-pro-latest',
      context: { context_mode: 'session_debrief', session_id: 7 },
    });
  });

  it('does not resend the failed answer when retrying it', async () => {
    const streamSpy = vi
      .spyOn(api, 'stream')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'busy', code: 'MODEL_OVERLOADED' }), { status: 503 }))
      .mockResolvedValueOnce(createMockSSEResponse(['data: {"text":"Retried"}\n\n']));
    const { result } = renderHook(() => useAIChatStream(defaultProps));

    await act(async () => {
      await result.current.sendMessage('Pace?');
    });
    const failedId = result.current.messages[2].id;
    await act(async () => {
      await result.current.retryLastMessage(failedId);
    });

    const retryBody = streamSpy.mock.calls[1][1] as { messages: { role: string; content: string }[] };
    expect(retryBody.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
    expect(result.current.messages.some((m) => m.id === failedId)).toBe(false);
    expect(result.current.messages[result.current.messages.length - 1].content).toBe('Retried');
  });
});
