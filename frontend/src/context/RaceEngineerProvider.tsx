import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { useI18n } from './I18nContext';
import { useSystemPrompt } from '../hooks/useSystemPrompt';
import { useAIModels } from '../hooks/useAIModels';
import { useAIChatStream } from '../hooks/useAIChatStream';
import { useAISettings } from '../hooks/useAISettings';
import { storage } from '../utils/storage';
import {
  RaceEngineerActionsContext,
  RaceEngineerStreamContext,
  STORAGE_KEY_AI_OPEN,
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

  // AI provider, model and key status, saved on the server
  const { config, keyStatus, saveConfig, saveApiKey } = useAISettings();

  // Composed Subsystems
  const { buildCurrentBackendContext } = useSystemPrompt({
    contextMode,
    comparatorContext,
    sessionDebriefContext,
    liveContext,
    locale,
  });

  const {
    availableModels,
    isLoadingModels,
    modelsError,
    fetchAvailableModels,
  } = useAIModels(config, keyStatus);

  const {
    messages,
    isGenerating,
    sendMessage,
    retryLastMessage,
    clearMessages,
    stopGenerating,
  } = useAIChatStream({
    config,
    keyStatus,
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
      keyStatus,
      saveApiKey,
      availableModels,
      isLoadingModels,
      modelsError,
      fetchAvailableModels,
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
      keyStatus,
      saveApiKey,
      availableModels,
      isLoadingModels,
      modelsError,
      fetchAvailableModels,
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
