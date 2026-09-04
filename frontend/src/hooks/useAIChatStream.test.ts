import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIChatStream } from './useAIChatStream';
import { api } from '../utils/apiClient';
import type { AIConfig } from '../context/RaceEngineerContext';

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
    apiKey: 'test-key',
    model: 'gemini-flash-lite-latest',
    baseUrl: '',
  };

  const defaultProps = {
    config: defaultConfig,
    serverConfigStatus: {
      hasGeminiEnvKey: false,
      hasOpenAIEnvKey: false,
      defaultProvider: 'gemini',
      defaultModel: 'gemini-flash-lite-latest',
    },
    buildCurrentBackendContext: () => ({
      context_mode: 'general' as const,
      language: 'en' as const,
    }),
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
      config: { ...defaultConfig, apiKey: '' },
      serverConfigStatus: null,
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
        persona: expect.any(String),
        language: expect.any(String),
      }),
      expect.any(AbortSignal)
    );
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
});
