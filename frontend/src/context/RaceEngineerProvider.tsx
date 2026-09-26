import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAIModels } from '../hooks/useAIModels';
import { useAIChatStream } from '../hooks/useAIChatStream';
import { useAISettings } from '../hooks/useAISettings';
import { storage } from '../utils/storage';
import { buildChatContextRequest } from '../utils/chatContext';
import {
  RaceEngineerActionsContext,
  RaceEngineerStateContext,
  RaceEngineerStreamContext,
  STORAGE_KEY_AI_OPEN,
  type ContextMode,
  type ComparatorChatTarget,
  type SessionDebriefChatTarget,
  type RaceEngineerActionsContextValue,
  type RaceEngineerStateContextValue,
  type RaceEngineerStreamContextValue,
} from './RaceEngineerContext';

export const RaceEngineerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Open / closed state saved to localStorage
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    return storage.get<boolean>(STORAGE_KEY_AI_OPEN, false);
  });

  useEffect(() => {
    storage.set(STORAGE_KEY_AI_OPEN, isOpen);
  }, [isOpen]);

  // What the chat is about: only identifiers, the server builds the prompt data from them
  const [contextMode, setContextMode] = useState<ContextMode>('general');
  const [comparatorTarget, setComparatorTarget] = useState<ComparatorChatTarget | null>(null);
  const [sessionDebriefTarget, setSessionDebriefTarget] = useState<SessionDebriefChatTarget | null>(null);

  // Read when a message is sent, so the chat callbacks never change with the context
  const targetsRef = useRef({ contextMode, comparatorTarget, sessionDebriefTarget });
  targetsRef.current = { contextMode, comparatorTarget, sessionDebriefTarget };
  const buildChatContext = useCallback(() => {
    const { contextMode: mode, comparatorTarget: comparator, sessionDebriefTarget: debrief } = targetsRef.current;
    return buildChatContextRequest(mode, comparator, debrief);
  }, []);

  // AI provider, model and key status, saved on the server
  const { config, keyStatus, saveConfig, saveApiKey } = useAISettings();

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
    buildChatContext,
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

  // Every dependency here is a stable callback, so this value never changes.
  const actionsValue = useMemo<RaceEngineerActionsContextValue>(
    () => ({
      openChat,
      closeChat,
      toggleChat,
      setContextMode,
      setComparatorTarget,
      setSessionDebriefTarget,
      sendMessage,
      retryLastMessage,
      clearMessages,
      stopGenerating,
      saveConfig,
      saveApiKey,
      fetchAvailableModels,
    }),
    [
      openChat,
      closeChat,
      toggleChat,
      sendMessage,
      retryLastMessage,
      clearMessages,
      stopGenerating,
      saveConfig,
      saveApiKey,
      fetchAvailableModels,
    ]
  );

  const stateValue = useMemo<RaceEngineerStateContextValue>(
    () => ({
      isOpen,
      contextMode,
      comparatorTarget,
      sessionDebriefTarget,
      config,
      keyStatus,
      availableModels,
      isLoadingModels,
      modelsError,
    }),
    [isOpen, contextMode, comparatorTarget, sessionDebriefTarget, config, keyStatus, availableModels, isLoadingModels, modelsError]
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
      <RaceEngineerStateContext.Provider value={stateValue}>
        <RaceEngineerStreamContext.Provider value={streamValue}>
          {children}
        </RaceEngineerStreamContext.Provider>
      </RaceEngineerStateContext.Provider>
    </RaceEngineerActionsContext.Provider>
  );
};
