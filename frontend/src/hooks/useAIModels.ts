import { useState, useCallback, useRef } from 'react';
import { api } from '../utils/apiClient';
import {
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIModelItem,
} from '../context/RaceEngineerContext';

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
 * Lists the chat models of the active provider. The server adds the saved or .env API key and
 * leaves out models that cannot chat. A list only shows while its provider (and, for custom
 * servers, its address) is the active one.
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
  // Read when fetching, so fetchAvailableModels keeps its identity across settings changes.
  const latest = useRef({ config, keyStatus });
  latest.current = { config, keyStatus };

  const fetchAvailableModels = useCallback(
    async (overrideConfig?: AIConfig) => {
      const { config: savedConfig, keyStatus: keys } = latest.current;
      const activeCfg = overrideConfig || savedConfig;
      const source = modelsSource(activeCfg);
      const seq = ++requestSeq.current;
      const baseUrl = activeCfg.baseUrl.trim();
      if (!providerHasKey(keys, activeCfg.provider) || (activeCfg.provider === 'custom' && !baseUrl)) {
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
          models: data?.models ?? [],
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
    []
  );

  const isCurrent = loaded.source === modelsSource(config);
  return {
    availableModels: isCurrent ? loaded.models : [],
    isLoadingModels,
    modelsError: isCurrent ? modelsError : null,
    fetchAvailableModels,
  };
};
