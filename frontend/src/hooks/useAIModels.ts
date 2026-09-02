import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/apiClient';
import type { AIConfig, AIModelItem } from '../context/RaceEngineerContext';

export interface ServerConfigStatus {
  hasGeminiEnvKey: boolean;
  hasOpenAIEnvKey: boolean;
  defaultProvider: string;
  defaultModel: string;
}

interface GeminiModelResponseItem {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

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
  serverConfigStatus: ServerConfigStatus | null;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (overrideConfig?: AIConfig) => Promise<void>;
}

export const useAIModels = (config: AIConfig): UseAIModelsReturn => {
  const [serverConfigStatus, setServerConfigStatus] = useState<ServerConfigStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Fetch server status on mount
  useEffect(() => {
    api.get<{
      has_gemini_env_key: boolean;
      has_openai_env_key: boolean;
      default_provider: 'gemini' | 'openai';
      default_model: string;
    }>('/api/ai/config-status')
      .then((data) => {
        setServerConfigStatus({
          hasGeminiEnvKey: data.has_gemini_env_key,
          hasOpenAIEnvKey: data.has_openai_env_key,
          defaultProvider: data.default_provider,
          defaultModel: data.default_model,
        });
      })
      .catch(() => {
        // AI config status is optional for local development
      });
  }, []);

  const fetchAvailableModels = useCallback(
    async (overrideConfig?: AIConfig) => {
      const activeCfg = overrideConfig || config;
      if (
        !activeCfg.apiKey &&
        !serverConfigStatus?.hasGeminiEnvKey &&
        !serverConfigStatus?.hasOpenAIEnvKey
      ) {
        return;
      }

      setIsLoadingModels(true);
      setModelsError(null);
      try {
        let data: { models: AIModelItem[] } | null = null;

        try {
          data = await api.post<{ models: AIModelItem[] }>('/api/ai/models', {
            provider: activeCfg.provider,
            api_key: activeCfg.apiKey,
            base_url: activeCfg.baseUrl,
          });
        } catch {
          // Fallback to direct provider query if backend route is unavailable
        }

        if (!data && activeCfg.provider === 'gemini' && activeCfg.apiKey) {
          const gJson = await api.get<{ models?: GeminiModelResponseItem[] }>(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${activeCfg.apiKey}`
          );
          const gModels: AIModelItem[] = (gJson.models || [])
            .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map((m) => ({
              id: m.name.replace('models/', ''),
              display_name: m.displayName || m.name.replace('models/', ''),
              description: m.description,
            }));
          data = { models: gModels };
        }

        if (data?.models && data.models.length > 0) {
          const filtered = filterChatModels(data.models, activeCfg.provider);
          setAvailableModels(filtered);
        } else {
          setAvailableModels([]);
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Could not query models list.';
        setModelsError(errorMsg);
      } finally {
        setIsLoadingModels(false);
      }
    },
    [config, serverConfigStatus]
  );

  return {
    serverConfigStatus,
    availableModels,
    isLoadingModels,
    modelsError,
    fetchAvailableModels,
  };
};
