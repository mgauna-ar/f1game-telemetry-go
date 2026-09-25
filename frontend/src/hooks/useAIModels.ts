import { useState, useCallback } from 'react';
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

/** Lists the chat models of the active provider. The server adds the saved or .env API key. */
export const useAIModels = (
  config: AIConfig,
  keyStatus: AIKeyStatusByProvider
): UseAIModelsReturn => {
  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const fetchAvailableModels = useCallback(
    async (overrideConfig?: AIConfig) => {
      const activeCfg = overrideConfig || config;
      if (!providerHasKey(keyStatus, activeCfg.provider)) {
        setAvailableModels([]);
        return;
      }

      setIsLoadingModels(true);
      setModelsError(null);
      try {
        const data = await api.post<{ models: AIModelItem[] }>('/api/ai/models', {
          provider: activeCfg.provider,
        });
        setAvailableModels(data?.models?.length ? filterChatModels(data.models, activeCfg.provider) : []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Could not query models list.';
        setModelsError(errorMsg);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [config, keyStatus]
  );

  return {
    availableModels,
    isLoadingModels,
    modelsError,
    fetchAvailableModels,
  };
};
