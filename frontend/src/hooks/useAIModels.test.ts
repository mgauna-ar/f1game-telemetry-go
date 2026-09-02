import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIModels, filterChatModels } from './useAIModels';
import { api } from '../utils/apiClient';
import type { AIConfig, AIModelItem } from '../context/RaceEngineerContext';

describe('useAIModels Hook', () => {
  const defaultConfig: AIConfig = {
    provider: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-flash-lite-latest',
    baseUrl: '',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('filters out non-chat models for gemini and openai', () => {
    const rawGemini: AIModelItem[] = [
      { id: 'gemini-2.5-flash', display_name: 'Flash' },
      { id: 'text-embedding-004', display_name: 'Embedding' },
      { id: 'imagen-3.0', display_name: 'Imagen' },
      { id: 'gemini-audio-tts', display_name: 'TTS' },
    ];

    const filteredGemini = filterChatModels(rawGemini, 'gemini');
    expect(filteredGemini).toHaveLength(1);
    expect(filteredGemini[0].id).toBe('gemini-2.5-flash');

    const rawOpenAI: AIModelItem[] = [
      { id: 'gpt-4o', display_name: 'GPT-4o' },
      { id: 'dall-e-3', display_name: 'Dall-E' },
      { id: 'whisper-1', display_name: 'Whisper' },
      { id: 'text-embedding-3-small', display_name: 'Embedding' },
    ];

    const filteredOpenAI = filterChatModels(rawOpenAI, 'openai');
    expect(filteredOpenAI).toHaveLength(1);
    expect(filteredOpenAI[0].id).toBe('gpt-4o');
  });

  it('fetches server config status on mount', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      has_gemini_env_key: true,
      has_openai_env_key: false,
      default_provider: 'gemini',
      default_model: 'gemini-flash-lite-latest',
    });

    const { result } = renderHook(() => useAIModels(defaultConfig));

    await waitFor(() => {
      expect(result.current.serverConfigStatus).not.toBeNull();
    });

    expect(result.current.serverConfigStatus).toEqual({
      hasGeminiEnvKey: true,
      hasOpenAIEnvKey: false,
      defaultProvider: 'gemini',
      defaultModel: 'gemini-flash-lite-latest',
    });
  });

  it('fetches available models via backend api', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({
      has_gemini_env_key: false,
      has_openai_env_key: false,
      default_provider: 'gemini',
      default_model: 'gemini-flash-lite-latest',
    });

    vi.spyOn(api, 'post').mockResolvedValueOnce({
      models: [
        { id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash' },
        { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro' },
      ],
    });

    const { result } = renderHook(() => useAIModels(defaultConfig));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(result.current.availableModels).toHaveLength(2);
    expect(result.current.modelsError).toBeNull();
  });

  it('falls back to direct Gemini API when backend route fails', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/ai/config-status') {
        return {
          has_gemini_env_key: false,
          has_openai_env_key: false,
          default_provider: 'gemini',
          default_model: 'gemini-flash-lite-latest',
        };
      }
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/embedding-001',
              displayName: 'Embedding',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        };
      }
      return {};
    });

    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Backend 404'));

    const { result } = renderHook(() => useAIModels(defaultConfig));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(result.current.availableModels).toHaveLength(1);
    expect(result.current.availableModels[0].id).toBe('gemini-2.5-flash');
  });

  it('sets error state when fetching fails completely', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/ai/config-status') {
        return {
          has_gemini_env_key: false,
          has_openai_env_key: false,
          default_provider: 'gemini',
          default_model: 'gemini-flash-lite-latest',
        };
      }
      throw new Error('API key invalid');
    });

    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Backend 404'));

    const { result } = renderHook(() => useAIModels(defaultConfig));

    await act(async () => {
      await result.current.fetchAvailableModels();
    });

    expect(result.current.modelsError).toBe('API key invalid');
    expect(result.current.availableModels).toEqual([]);
  });
});
