import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { useI18n } from './I18nContext';
import { useSystemPrompt } from '../hooks/useSystemPrompt';
import { useAIModels } from '../hooks/useAIModels';
import { useAIChatStream } from '../hooks/useAIChatStream';
import { storage } from '../utils/storage';
import {
  RaceEngineerActionsContext,
  RaceEngineerStreamContext,
  DEFAULT_CONFIG,
  STORAGE_KEY_AI_CONFIG,
  STORAGE_KEY_AI_OPEN,
  type AIConfig,
  type ContextMode,
  type SessionDebriefContextPayload,
  type LiveContextPayload,
  type RaceEngineerActionsContextValue,
  type RaceEngineerStreamContextValue,
} from './RaceEngineerContext';

export const RaceEngineerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let locale: 'en' | 'es' = 'en';
  try {
    const i18n = useI18n();
    locale = i18n.locale;
  } catch {
    // If not inside I18nProvider
  }

  // Open / closed state saved to localStorage
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return storage.get<boolean>(STORAGE_KEY_AI_OPEN, false);
  });

  useEffect(() => {
    storage.set(STORAGE_KEY_AI_OPEN, isOpen);
  }, [isOpen]);

  // Active telemetry contexts
  const [contextMode, setContextMode] = useState<ContextMode>('general');
  const [comparatorContext, setComparatorContext] = useState<TelemetryContextPayload | null>(null);
  const [sessionDebriefContext, setSessionDebriefContext] =
    useState<SessionDebriefContextPayload | null>(null);
  const [liveContext, setLiveContext] = useState<LiveContextPayload | null>(null);

  // AI Configuration
  const [config, setConfig] = useState<AIConfig>(() => {
    const parsed = storage.get<Partial<AIConfig> | null>(STORAGE_KEY_AI_CONFIG, null);
    if (parsed) {
      const currentProv = parsed.provider || 'gemini';
      const providerKeys: Record<string, string> = {
        gemini: '',
        openai: '',
        custom: '',
        ...(parsed.providerKeys || {}),
      };
      const providerModels: Record<string, string> = {
        gemini: 'gemini-flash-lite-latest',
        openai: 'gpt-4o-mini',
        custom: 'llama3',
        ...(parsed.providerModels || {}),
      };

      if (parsed.apiKey && !providerKeys[currentProv]) {
        providerKeys[currentProv] = parsed.apiKey;
      }
      if (parsed.model && !providerModels[currentProv]) {
        providerModels[currentProv] = parsed.model;
      }
      if (
        providerModels.gemini === 'gemini-2.0-flash' ||
        providerModels.gemini === 'gemini-2.5-flash' ||
        providerModels.gemini === 'gemini-1.5-flash'
      ) {
        providerModels.gemini = 'gemini-flash-lite-latest';
      }

      const activeKey = providerKeys[currentProv] || '';
      const activeModel =
        providerModels[currentProv] ||
        (currentProv === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini');

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        provider: currentProv,
        apiKey: activeKey,
        model: activeModel,
        providerKeys,
        providerModels,
      };
    }
    return DEFAULT_CONFIG;
  });

  const saveConfig = useCallback((newConfig: AIConfig) => {
    setConfig(newConfig);
    storage.set(STORAGE_KEY_AI_CONFIG, newConfig);
  }, []);

  // Composed Subsystems
  const { buildCurrentBackendContext } = useSystemPrompt({
    contextMode,
    comparatorContext,
    sessionDebriefContext,
    liveContext,
    locale,
  });

  const {
    serverConfigStatus,
    availableModels,
    isLoadingModels,
    modelsError,
    fetchAvailableModels,
  } = useAIModels(config);

  const {
    messages,
    isGenerating,
    sendMessage,
    retryLastMessage,
    clearMessages,
    stopGenerating,
  } = useAIChatStream({
    config,
    serverConfigStatus,
    buildCurrentBackendContext,
  });

  const openChat = useCallback(
    (initialPrompt?: string) => {
      setIsOpen(true);
      if (initialPrompt && initialPrompt.trim()) {
        setTimeout(() => {
          sendMessage(initialPrompt);
        }, 50);
      }
    },
    [sendMessage]
  );

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const actionsValue = useMemo<RaceEngineerActionsContextValue>(
    () => ({
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      contextMode,
      setContextMode,
      comparatorContext,
      setComparatorContext,
      sessionDebriefContext,
      setSessionDebriefContext,
      liveContext,
      setLiveContext,
      sendMessage,
      retryLastMessage,
      clearMessages,
      stopGenerating,
      config,
      saveConfig,
      availableModels,
      isLoadingModels,
      modelsError,
      fetchAvailableModels,
      serverConfigStatus,
    }),
    [
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      contextMode,
      comparatorContext,
      sessionDebriefContext,
      liveContext,
      sendMessage,
      retryLastMessage,
      clearMessages,
      stopGenerating,
      config,
      saveConfig,
      availableModels,
      isLoadingModels,
      modelsError,
      fetchAvailableModels,
      serverConfigStatus,
    ]
  );

  const streamValue = useMemo<RaceEngineerStreamContextValue>(
    () => ({
      messages,
      isGenerating,
    }),
    [messages, isGenerating]
  );

  return (
    <RaceEngineerActionsContext.Provider value={actionsValue}>
      <RaceEngineerStreamContext.Provider value={streamValue}>
        {children}
      </RaceEngineerStreamContext.Provider>
    </RaceEngineerActionsContext.Provider>
  );
};
