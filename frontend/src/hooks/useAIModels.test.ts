import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIModels } from './useAIModels';
import { api } from '../utils/apiClient';
import {
  NO_AI_KEYS,
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIModelItem,
} from '../context/RaceEngineerContext';

describe('useAIModels Hook', () => {
  const defaultConfig: AIConfig = {
    provider: 'gemini',
    model: 'gemini-flash-lite-latest',
    baseUrl: '',
    providerModels: { gemini: 'gemini-flash-lite-latest', openai: '', claude: '', custom: '' },
  };

  const geminiEnvKey: AIKeyStatusByProvider = {
    ...NO_AI_KEYS,
    gemini: { hasSavedKey: false, hasEnvKey: true },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches available models through the server without sending a key', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      models: [
        { id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash' },
        { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro' },
      ],
    });

    const { result } = renderHook(() => useAIModels(defaultConfig, geminiEnvKey));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(postSpy).toHaveBeenCalledWith('/api/ai/models', { provider: 'gemini' });
    expect(result.current.availableModels).toHaveLength(2);
    expect(result.current.modelsError).toBeNull();
  });

  it('skips the request when the provider has no key on the server', async () => {
    const postSpy = vi.spyOn(api, 'post');

    const { result } = renderHook(() => useAIModels(defaultConfig, NO_AI_KEYS));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(postSpy).not.toHaveBeenCalled();
    expect(result.current.availableModels).toEqual([]);
  });

  it('lists models for a custom endpoint even without a key, at the address being set up', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      models: [{ id: 'llama3', display_name: 'llama3' }],
    });
    const customConfig: AIConfig = {
      ...defaultConfig,
      provider: 'custom',
      model: 'llama3',
      baseUrl: 'http://localhost:11434/v1',
    };

    const { result } = renderHook(() => useAIModels(customConfig, NO_AI_KEYS));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(postSpy).toHaveBeenCalledWith('/api/ai/models', {
      provider: 'custom',
      base_url: 'http://localhost:11434/v1',
    });
    expect(result.current.availableModels).toHaveLength(1);
  });

  it('skips the request for a custom endpoint without an address', async () => {
    const postSpy = vi.spyOn(api, 'post');
    const customConfig: AIConfig = { ...defaultConfig, provider: 'custom', model: 'llama3' };

    const { result } = renderHook(() => useAIModels(customConfig, NO_AI_KEYS));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(postSpy).not.toHaveBeenCalled();
    expect(result.current.availableModels).toEqual([]);
  });

  it('hides a model list once another provider is picked', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce({
      models: [{ id: 'gemini-flash-latest', display_name: 'Gemini Flash' }],
    });

    const { result, rerender } = renderHook(({ cfg }) => useAIModels(cfg, geminiEnvKey), {
      initialProps: { cfg: defaultConfig },
    });
    await act(async () => {
      await result.current.fetchAvailableModels();
    });
    expect(result.current.availableModels).toHaveLength(1);

    rerender({ cfg: { ...defaultConfig, provider: 'openai', model: 'gpt-4o-mini' } });
    expect(result.current.availableModels).toEqual([]);
  });

  it('keeps only the answer to the latest request', async () => {
    let answerFirst: (value: { models: AIModelItem[] }) => void = () => {};
    vi.spyOn(api, 'post')
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce({ models: [{ id: 'gemini-new', display_name: 'new' }] });

    const { result } = renderHook(() => useAIModels(defaultConfig, geminiEnvKey));
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.fetchAvailableModels();
      await result.current.fetchAvailableModels();
    });
    await act(async () => {
      answerFirst({ models: [{ id: 'gemini-old', display_name: 'old' }] });
      await first;
    });

    expect(result.current.availableModels.map((m) => m.id)).toEqual(['gemini-new']);
  });

  it('sets error state when fetching fails', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('API key invalid'));

    const { result } = renderHook(() => useAIModels(defaultConfig, geminiEnvKey));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    await waitFor(() => expect(result.current.modelsError).toBe('API key invalid'));
    expect(result.current.availableModels).toEqual([]);
  });

  it('matches each provider with its own key', () => {
    const status: AIKeyStatusByProvider = {
      ...NO_AI_KEYS,
      openai: { hasSavedKey: false, hasEnvKey: true },
      claude: { hasSavedKey: true, hasEnvKey: false },
    };
    expect(providerHasKey(status, 'gemini')).toBe(false);
    expect(providerHasKey(status, 'openai')).toBe(true);
    expect(providerHasKey(status, 'claude')).toBe(true);
    expect(providerHasKey(NO_AI_KEYS, 'claude')).toBe(false);
    // Custom endpoints like Ollama may not need a key
    expect(providerHasKey(NO_AI_KEYS, 'custom')).toBe(true);
  });
});
