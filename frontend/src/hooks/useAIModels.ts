import { useState, useCallback, useRef } from 'react';
import { api } from '../utils/apiClient';
import {
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIModelItem,
} from '../context/RaceEngineerContext';

export const filterChatModels = (rawModels: AIModelItem[], provider: string): AIModelItem[] => {
  return rawModels.filter((m) => {
    const id = m.id.toLowerCase();
    if (provider === 'gemini') {
      if (!id.startsWith('gemini-')) return false;
      if (
        id.includes('banana') ||
        id.includes('imagen') ||
        id.includes('image') ||
        id.includes('embedding') ||
        id.includes('aqa') ||
        id.includes('tts') ||
        id.includes('audio') ||
        id.includes('vision') ||
        id.includes('robotics')
      ) {
        return false;
      }
      return true;
    }
    if (provider === 'openai') {
      if (
        id.includes('audio') ||
        id.includes('realtime') ||
        id.includes('tts') ||
        id.includes('whisper') ||
        id.includes('dall-e') ||
        id.includes('embedding') ||
        id.includes('moderation') ||
        id.includes('davinci') ||
        id.includes('babbage') ||
        id.includes('instruct') ||
        id.includes('canary')
      ) {
        return false;
      }
    }
    return true;
  });
};

export interface UseAIModelsReturn {
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (overrideConfig?: AIConfig) => Promise<void>;
}

/** Which provider and server a model list belongs to. */
const modelsSource = (cfg: AIConfig): string =>
  cfg.provider === 'custom' ? `custom|${cfg.baseUrl.trim()}` : cfg.provider;

/**
 * Lists the chat models of the active provider. The server adds the saved or .env API key. A list
 * only shows while its provider (and, for custom servers, its address) is the active one.
 */
export const useAIModels = (
  config: AIConfig,
  keyStatus: AIKeyStatusByProvider
): UseAIModelsReturn => {
  const [loaded, setLoaded] = useState<{ source: string; models: AIModelItem[] }>({ source: '', models: [] });
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // Requests can overlap when the provider changes; only the latest one may update the state.
  const requestSeq = useRef(0);

  const fetchAvailableModels = useCallback(
    async (overrideConfig?: AIConfig) => {
      const activeCfg = overrideConfig || config;
      const source = modelsSource(activeCfg);
      const seq = ++requestSeq.current;
      const baseUrl = activeCfg.baseUrl.trim();
      if (!providerHasKey(keyStatus, activeCfg.provider) || (activeCfg.provider === 'custom' && !baseUrl)) {
        setLoaded({ source, models: [] });
        setModelsError(null);
        setIsLoadingModels(false);
        return;
      }

      setIsLoadingModels(true);
      setModelsError(null);
      try {
        const data = await api.post<{ models: AIModelItem[] }>('/api/ai/models', {
          provider: activeCfg.provider,
          // The address being set up, which the server may not have saved yet.
          ...(activeCfg.provider === 'custom' ? { base_url: baseUrl } : {}),
        });
        if (seq !== requestSeq.current) return;
        setLoaded({
          source,
          models: data?.models?.length ? filterChatModels(data.models, activeCfg.provider) : [],
        });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const errorMsg = err instanceof Error ? err.message : 'Could not query models list.';
        setLoaded({ source, models: [] });
        setModelsError(errorMsg);
      } finally {
        if (seq === requestSeq.current) setIsLoadingModels(false);
      }
    },
    [config, keyStatus]
  );

  const isCurrent = loaded.source === modelsSource(config);
  return {
    availableModels: isCurrent ? loaded.models : [],
    isLoadingModels,
    modelsError: isCurrent ? modelsError : null,
    fetchAvailableModels,
  };
};
