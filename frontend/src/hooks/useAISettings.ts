import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/apiClient';
import { storage } from '../utils/storage';
import {
  AI_PROVIDERS,
  DEFAULT_CONFIG,
  NO_AI_KEYS,
  STORAGE_KEY_AI_CONFIG,
  isAIProvider,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIProvider,
} from '../context/RaceEngineerContextDefinitions';

/** What GET and PUT /api/settings/ai return. API keys are never included. */
export interface AISettingsResponse {
  saved: boolean;
  provider: string;
  base_url: string;
  providers: Record<string, { model: string; has_saved_key: boolean; has_env_key: boolean } | undefined>;
}

/** A partial change for PUT /api/settings/ai. An empty model or key removes the saved one. */
export interface AISettingsUpdate {
  provider?: AIProvider;
  models?: Partial<Record<AIProvider, string>>;
  base_url?: string;
  api_keys?: Partial<Record<AIProvider, string>>;
}

/** The AI config older versions kept in each browser, API keys included. */
export interface LegacyAIConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  providerKeys?: Record<string, string>;
  providerModels?: Record<string, string>;
}

/** Gemini models older browser configs pinned that Google has since retired. */
const RETIRED_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

export function fromSettingsResponse(res: AISettingsResponse): {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
} {
  const provider = isAIProvider(res.provider) ? res.provider : DEFAULT_CONFIG.provider;
  const providerModels = { ...DEFAULT_CONFIG.providerModels };
  const keyStatus = { ...NO_AI_KEYS };
  for (const p of AI_PROVIDERS) {
    const status = res.providers?.[p];
    if (!status) continue;
    providerModels[p] = status.model || '';
    keyStatus[p] = { hasSavedKey: !!status.has_saved_key, hasEnvKey: !!status.has_env_key };
  }
  return {
    config: { provider, model: providerModels[provider], baseUrl: res.base_url || '', providerModels },
    keyStatus,
  };
}

/**
 * Builds the one-time upload of an AI config an older version kept in this browser. Keys go up
 * only for providers the server has no saved key for. Provider, models and base URL go up only
 * when the server never saved AI settings, so a second browser can't undo choices made since.
 */
export function legacyConfigUpdate(
  legacy: LegacyAIConfig,
  server: AISettingsResponse
): AISettingsUpdate | null {
  const activeProvider = isAIProvider(legacy.provider) ? legacy.provider : null;
  const update: AISettingsUpdate = {};

  const keys: Record<string, string> = { ...(legacy.providerKeys || {}) };
  if (activeProvider && legacy.apiKey && !keys[activeProvider]) {
    keys[activeProvider] = legacy.apiKey;
  }
  const apiKeys: Partial<Record<AIProvider, string>> = {};
  for (const p of AI_PROVIDERS) {
    const key = keys[p]?.trim();
    if (key && !server.providers?.[p]?.has_saved_key) apiKeys[p] = key;
  }
  if (Object.keys(apiKeys).length > 0) update.api_keys = apiKeys;

  if (!server.saved) {
    if (activeProvider) update.provider = activeProvider;

    const models: Record<string, string> = { ...(legacy.providerModels || {}) };
    if (activeProvider && legacy.model && !models[activeProvider]) {
      models[activeProvider] = legacy.model;
    }
    const changedModels: Partial<Record<AIProvider, string>> = {};
    for (const p of AI_PROVIDERS) {
      const model = models[p]?.trim();
      if (!model || model === server.providers?.[p]?.model) continue;
      if (p === 'gemini' && RETIRED_GEMINI_MODELS.includes(model)) continue;
      changedModels[p] = model;
    }
    if (Object.keys(changedModels).length > 0) update.models = changedModels;

    const baseUrl = legacy.baseUrl?.trim();
    if (baseUrl) update.base_url = baseUrl;
  }

  return Object.keys(update).length > 0 ? update : null;
}

/** Only the fields of `next` that differ from `prev`, as a settings update. */
function configChanges(prev: AIConfig, next: AIConfig): AISettingsUpdate {
  const update: AISettingsUpdate = {};
  if (next.provider !== prev.provider) update.provider = next.provider;
  const models: Partial<Record<AIProvider, string>> = {};
  for (const p of AI_PROVIDERS) {
    if (next.providerModels[p] !== prev.providerModels[p]) models[p] = next.providerModels[p];
  }
  if (Object.keys(models).length > 0) update.models = models;
  if (next.baseUrl !== prev.baseUrl) update.base_url = next.baseUrl;
  return update;
}

export interface UseAISettingsReturn {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  saveConfig: (next: AIConfig) => void;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
}

/** Loads the AI chat settings from the server and saves changes back, so every device shares them. */
export function useAISettings(): UseAISettingsReturn {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [keyStatus, setKeyStatus] = useState<AIKeyStatusByProvider>(NO_AI_KEYS);
  const configRef = useRef<AIConfig>(DEFAULT_CONFIG);
  // Saves can overlap; only the answer to the latest request may update the state.
  const requestSeq = useRef(0);

  const applyResponse = useCallback((res: AISettingsResponse, seq: number) => {
    if (seq !== requestSeq.current) return;
    const next = fromSettingsResponse(res);
    configRef.current = next.config;
    setConfig(next.config);
    setKeyStatus(next.keyStatus);
  }, []);

  const putSettings = useCallback(
    async (update: AISettingsUpdate) => {
      const seq = ++requestSeq.current;
      const res = await api.put<AISettingsResponse>('/api/settings/ai', update);
      applyResponse(res, seq);
    },
    [applyResponse]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const seq = ++requestSeq.current;
      const res = await api.get<AISettingsResponse>('/api/settings/ai').catch(() => null);
      if (cancelled || !res) return;
      applyResponse(res, seq);

      const legacy = storage.get<LegacyAIConfig | null>(STORAGE_KEY_AI_CONFIG, null);
      if (!legacy) return;
      const update = legacyConfigUpdate(legacy, res);
      try {
        if (update) await putSettings(update);
        storage.remove(STORAGE_KEY_AI_CONFIG);
      } catch (err) {
        // Keep the old config so the next load tries again.
        console.warn('[useAISettings] Moving browser AI settings to the server failed:', err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applyResponse, putSettings]);

  const saveConfig = useCallback(
    (next: AIConfig) => {
      const merged: AIConfig = {
        ...next,
        providerModels: { ...next.providerModels, [next.provider]: next.model },
      };
      const update = configChanges(configRef.current, merged);
      configRef.current = merged;
      setConfig(merged);
      if (Object.keys(update).length === 0) return;
      putSettings(update).catch((err) => console.warn('[useAISettings] Save failed:', err));
    },
    [putSettings]
  );

  const saveApiKey = useCallback(
    (provider: AIProvider, apiKey: string) => putSettings({ api_keys: { [provider]: apiKey.trim() } }),
    [putSettings]
  );

  return { config, keyStatus, saveConfig, saveApiKey };
}
