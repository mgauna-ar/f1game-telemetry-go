import { useState, useRef, useCallback, useMemo } from 'react';
import { api } from '../utils/apiClient';
import { ChatStreamError, chatStreamErrorFromResponse, readChatStream } from '../utils/sseUtils';
import { AI_ERROR_CODES } from '../constants/f1';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { useI18n } from '../context/I18nContext';
import {
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type ChatMessage,
} from '../context/RaceEngineerContext';
import type { BackendContextPayload } from './useSystemPrompt';

export interface UseAIChatStreamProps {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  buildCurrentBackendContext: () => BackendContextPayload;
}

export interface UseAIChatStreamReturn {
  messages: ChatMessage[];
  isGenerating: boolean;
  sendMessage: (customPrompt?: string) => Promise<void>;
  retryLastMessage: (assistantMsgId?: string) => Promise<void>;
  stopGenerating: () => void;
  clearMessages: () => void;
}

const WELCOME_MESSAGE_ID = 'welcome';
const CLEARED_MESSAGE_ID_PREFIX = 'welcome-cleared-';

/** The greeting that opens the chat (or reopens it after a clear); never sent to the model. */
const isGreeting = (m: ChatMessage): boolean =>
  m.id === WELCOME_MESSAGE_ID || m.id.startsWith(CLEARED_MESSAGE_ID_PREFIX);

const createGreeting = (id: string): ChatMessage => ({
  id,
  role: 'assistant',
  // Filled in with the current language when the messages are returned
  content: '',
  timestamp: new Date(),
});

/** Codes worth a retry button: the same request may succeed a moment later. */
const RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set([
  AI_ERROR_CODES.MODEL_OVERLOADED,
  AI_ERROR_CODES.NETWORK_ERROR,
  AI_ERROR_CODES.GENERIC_ERROR,
]);

/**
 * Server failures already carry a code. Only a request that never got an answer (fetch rejects
 * with a TypeError such as "Failed to fetch") is classified here.
 */
const toChatStreamError = (err: unknown, fallbackMessage: string): ChatStreamError => {
  if (err instanceof ChatStreamError) return err;
  if (err instanceof TypeError) return new ChatStreamError(err.message, AI_ERROR_CODES.NETWORK_ERROR);
  const message = err instanceof Error && err.message ? err.message : fallbackMessage;
  return new ChatStreamError(message, AI_ERROR_CODES.GENERIC_ERROR);
};

export const useAIChatStream = ({
  config,
  keyStatus,
  buildCurrentBackendContext,
}: UseAIChatStreamProps): UseAIChatStreamReturn => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createGreeting(WELCOME_MESSAGE_ID)]);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (customPrompt?: string) => {
      const text = customPrompt?.trim();
      if (!text || isGenerating) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        lastPrompt: text,
      };

      const nextMessages = [...messages, userMsg, assistantMsg];
      setMessages(nextMessages);

      // Show the missing key card right away instead of waiting for the server to refuse
      if (!providerHasKey(keyStatus, config.provider)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: '',
                  errorCode: AI_ERROR_CODES.MISSING_API_KEY,
                  errorProvider: config.provider,
                  errorRaw: `No API key configured for ${config.provider}.`,
                  canRetry: false,
                  lastPrompt: text,
                }
              : m
          )
        );
        return;
      }

      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiMessages = nextMessages
          .filter((m) => !isGreeting(m) && m.id !== assistantMsgId)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const backendContext = buildCurrentBackendContext();
        const radioState = useRadioSettingsStore.getState();

        const res = await api.stream(
          '/api/ai/chat',
          {
            // The server adds the API key and custom base URL from its saved settings.
            provider: config.provider,
            model: config.model,
            persona: radioState.persona,
            language: radioState.radioLanguage,
            messages: apiMessages,
            context: backendContext,
          },
          controller.signal
        );

        if (!res.ok) {
          throw await chatStreamErrorFromResponse(res);
        }

        let accumulated = '';
        await readChatStream(res, (chunk) => {
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated, errorCode: undefined } : m))
          );
        });

        if (!accumulated.trim()) {
          throw new ChatStreamError(t('ai_engineer.errors.emptyResponseDesc'), AI_ERROR_CODES.GENERIC_ERROR);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          const stoppedNote = `\n\n*${t('ai_engineer.analysisStopped')}*`;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + stoppedNote } : m))
          );
        } else {
          const error = toChatStreamError(err, t('ai_engineer.errors.genericErrorDesc'));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: '',
                    errorCode: error.code,
                    errorProvider: error.provider || config.provider,
                    errorRaw: error.message,
                    canRetry: RETRYABLE_ERROR_CODES.has(error.code),
                    lastPrompt: text,
                  }
                : m
            )
          );
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      buildCurrentBackendContext,
      config,
      isGenerating,
      messages,
      keyStatus,
      t,
    ]
  );

  const retryLastMessage = useCallback(
    async (assistantMsgId?: string) => {
      if (isGenerating) return;

      let promptToRetry = '';
      if (assistantMsgId) {
        const target = messages.find((m) => m.id === assistantMsgId);
        if (target?.lastPrompt) {
          promptToRetry = target.lastPrompt;
        }
      }

      if (!promptToRetry) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user' && messages[i].content) {
            promptToRetry = messages[i].content;
            break;
          }
        }
      }

      if (promptToRetry) {
        if (assistantMsgId) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        }
        await sendMessage(promptToRetry);
      }
    },
    [isGenerating, messages, sendMessage]
  );

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([createGreeting(`${CLEARED_MESSAGE_ID_PREFIX}${Date.now()}`)]);
  }, []);

  // Greetings are translated here rather than stored, so they follow a language change
  const localizedMessages = useMemo(
    () =>
      messages.map((m) =>
        isGreeting(m)
          ? {
              ...m,
              content: t(m.id === WELCOME_MESSAGE_ID ? 'ai_engineer.welcomeMessage' : 'ai_engineer.clearedMessage'),
            }
          : m
      ),
    [messages, t]
  );

  return {
    messages: localizedMessages,
    isGenerating,
    sendMessage,
    retryLastMessage,
    stopGenerating,
    clearMessages,
  };
};
