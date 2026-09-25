import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAISettings,
  fromSettingsResponse,
  legacyConfigUpdate,
  type AISettingsResponse,
} from './useAISettings';
import { api } from '../utils/apiClient';
import { STORAGE_KEY_AI_CONFIG } from '../context/RaceEngineerContext';

const serverSettings = (overrides: Partial<AISettingsResponse> = {}): AISettingsResponse => ({
  saved: false,
  provider: 'gemini',
  base_url: '',
  providers: {
    gemini: { model: 'gemini-flash-latest', has_saved_key: false, has_env_key: true },
    openai: { model: 'gpt-4o-mini', has_saved_key: false, has_env_key: false },
    claude: { model: 'claude-default', has_saved_key: false, has_env_key: false },
    custom: { model: 'gpt-4o-mini', has_saved_key: false, has_env_key: false },
  },
  ...overrides,
});

describe('fromSettingsResponse', () => {
  it('maps the server answer to the chat config and key status', () => {
    const { config, keyStatus } = fromSettingsResponse(serverSettings({ provider: 'claude' }));
    expect(config.provider).toBe('claude');
    expect(config.model).toBe('claude-default');
    expect(config.providerModels.openai).toBe('gpt-4o-mini');
    expect(keyStatus.gemini).toEqual({ hasSavedKey: false, hasEnvKey: true });
    expect(keyStatus.claude).toEqual({ hasSavedKey: false, hasEnvKey: false });
  });

  it('falls back to Gemini for a provider this dashboard does not know', () => {
    expect(fromSettingsResponse(serverSettings({ provider: 'skynet' })).config.provider).toBe('gemini');
  });
});

describe('legacyConfigUpdate', () => {
  const legacy = {
    provider: 'custom',
    apiKey: 'c-key',
    model: 'llama3',
    baseUrl: 'http://localhost:11434/v1',
    providerKeys: { gemini: 'g-key', openai: '' },
    providerModels: { gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini' },
  };

  it('moves everything the first time, skipping retired and unchanged models', () => {
    expect(legacyConfigUpdate(legacy, serverSettings())).toEqual({
      provider: 'custom',
      api_keys: { gemini: 'g-key', custom: 'c-key' },
      models: { custom: 'llama3' },
      base_url: 'http://localhost:11434/v1',
    });
  });

  it('only fills in missing keys once the server has saved settings', () => {
    const saved = serverSettings({ saved: true });
    saved.providers.gemini = { model: 'gemini-flash-latest', has_saved_key: true, has_env_key: false };
    expect(legacyConfigUpdate(legacy, saved)).toEqual({ api_keys: { custom: 'c-key' } });
  });

  it('returns null when there is nothing to move', () => {
    expect(legacyConfigUpdate({ provider: 'gemini' }, serverSettings({ saved: true }))).toBeNull();
  });
});

describe('useAISettings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads the settings from the server', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(serverSettings({ provider: 'openai' }));

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => expect(result.current.config.provider).toBe('openai'));
    expect(result.current.config.model).toBe('gpt-4o-mini');
    expect(result.current.keyStatus.gemini.hasEnvKey).toBe(true);
  });

  it('moves an old browser config to the server once and deletes it, keys included', async () => {
    localStorage.setItem(
      STORAGE_KEY_AI_CONFIG,
      JSON.stringify({ provider: 'openai', apiKey: 'o-key', model: 'gpt-4o', providerKeys: { openai: 'o-key' } })
    );
    vi.spyOn(api, 'get').mockResolvedValueOnce(serverSettings());
    const putSpy = vi.spyOn(api, 'put').mockResolvedValueOnce(
      serverSettings({ saved: true, provider: 'openai' })
    );

    const { result } = renderHook(() => useAISettings());

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY_AI_CONFIG)).toBeNull());
    expect(putSpy).toHaveBeenCalledWith('/api/settings/ai', {
      provider: 'openai',
      api_keys: { openai: 'o-key' },
      models: { openai: 'gpt-4o' },
    });
    await waitFor(() => expect(result.current.config.provider).toBe('openai'));
  });

  it('keeps the old browser config when the upload fails, so the next load retries', async () => {
    localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify({ providerKeys: { gemini: 'g-key' } }));
    vi.spyOn(api, 'get').mockResolvedValueOnce(serverSettings());
    const putSpy = vi.spyOn(api, 'put').mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useAISettings());

    await waitFor(() => expect(putSpy).toHaveBeenCalled());
    expect(localStorage.getItem(STORAGE_KEY_AI_CONFIG)).not.toBeNull();
  });

  it('saves only what changed, and keys separately', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(serverSettings());
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue(serverSettings({ saved: true }));

    const { result } = renderHook(() => useAISettings());
    await waitFor(() => expect(result.current.config.model).toBe('gemini-flash-latest'));

    act(() => {
      result.current.saveConfig({ ...result.current.config, model: 'gemini-pro-latest' });
    });
    expect(putSpy).toHaveBeenLastCalledWith('/api/settings/ai', { models: { gemini: 'gemini-pro-latest' } });

    await act(async () => {
      await result.current.saveApiKey('claude', '  sk-ant  ');
    });
    expect(putSpy).toHaveBeenLastCalledWith('/api/settings/ai', { api_keys: { claude: 'sk-ant' } });
  });
});
