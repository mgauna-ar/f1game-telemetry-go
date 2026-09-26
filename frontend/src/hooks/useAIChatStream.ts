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
import type { AIChatRequest, ChatContextRequest } from '../types/ai';
import { resolveRadioLanguage } from '../utils/chatContext';

export interface UseAIChatStreamProps {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  /** What the chat is about, read when a message is sent. */
  buildChatContext: () => ChatContextRequest;
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

/**
 * The chat conversation and its streamed replies. Every returned callback keeps its identity:
 * they read the latest messages, settings and context through refs, so consumers that only
 * send or stop messages don't re-render on each streamed chunk.
 */
export const useAIChatStream = ({
  config,
  keyStatus,
  buildChatContext,
}: UseAIChatStreamProps): UseAIChatStreamReturn => {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createGreeting(WELCOME_MESSAGE_ID)]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Updated synchronously, so a send right after a retry's removal sees the removal.
  const messagesRef = useRef(messages);
  const generatingRef = useRef(false);
  // Keeps message IDs unique when two are created in the same millisecond (a quick retry).
  const messageSeq = useRef(0);
  const latest = useRef({ config, keyStatus, buildChatContext, t, locale });
  latest.current = { config, keyStatus, buildChatContext, t, locale };

  const commitMessages = useCallback((update: (prev: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessages(messagesRef.current);
  }, []);

  const setGenerating = useCallback((value: boolean) => {
    generatingRef.current = value;
    setIsGenerating(value);
  }, []);

  const sendMessage = useCallback(
    async (customPrompt?: string) => {
      const text = customPrompt?.trim();
      if (!text || generatingRef.current) return;
      const { config: cfg, keyStatus: keys, t: tr } = latest.current;
      const idSuffix = `${Date.now()}-${++messageSeq.current}`;

      const userMsg: ChatMessage = {
        id: `user-${idSuffix}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      const assistantMsgId = `assistant-${idSuffix}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        lastPrompt: text,
      };

      commitMessages((prev) => [...prev, userMsg, assistantMsg]);
      const updateAssistant = (patch: (m: ChatMessage) => ChatMessage) =>
        commitMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? patch(m) : m)));

      // Show the missing key card right away instead of waiting for the server to refuse
      if (!providerHasKey(keys, cfg.provider)) {
        updateAssistant((m) => ({
          ...m,
          content: '',
          errorCode: AI_ERROR_CODES.MISSING_API_KEY,
          errorProvider: cfg.provider,
          errorRaw: `No API key configured for ${cfg.provider}.`,
          canRetry: false,
          lastPrompt: text,
        }));
        return;
      }

      setGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const apiMessages = messagesRef.current
          .filter((m) => !isGreeting(m) && m.id !== assistantMsgId)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const radioState = useRadioSettingsStore.getState();
        const body: AIChatRequest = {
          // The server adds the API key and custom base URL from its saved settings.
          provider: cfg.provider,
          model: cfg.model,
          persona: radioState.persona,
          language: resolveRadioLanguage(radioState.radioLanguage, latest.current.locale),
          messages: apiMessages,
          context: latest.current.buildChatContext(),
        };
        const res = await api.stream('/api/ai/chat', body, controller.signal);

        if (!res.ok) {
          throw await chatStreamErrorFromResponse(res);
        }

        let accumulated = '';
        await readChatStream(res, (chunk) => {
          accumulated += chunk;
          updateAssistant((m) => ({ ...m, content: accumulated, errorCode: undefined }));
        });

        if (!accumulated.trim()) {
          throw new ChatStreamError(tr('ai_engineer.errors.emptyResponseDesc'), AI_ERROR_CODES.GENERIC_ERROR);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          const stoppedNote = `\n\n*${tr('ai_engineer.analysisStopped')}*`;
          updateAssistant((m) => ({ ...m, content: m.content + stoppedNote }));
        } else {
          const error = toChatStreamError(err, tr('ai_engineer.errors.genericErrorDesc'));
          updateAssistant((m) => ({
            ...m,
            content: '',
            errorCode: error.code,
            errorProvider: error.provider || cfg.provider,
            errorRaw: error.message,
            canRetry: RETRYABLE_ERROR_CODES.has(error.code),
            lastPrompt: text,
          }));
        }
      } finally {
        setGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [commitMessages, setGenerating]
  );

  const retryLastMessage = useCallback(
    async (assistantMsgId?: string) => {
      if (generatingRef.current) return;
      const current = messagesRef.current;

      let promptToRetry = '';
      if (assistantMsgId) {
        const target = current.find((m) => m.id === assistantMsgId);
        if (target?.lastPrompt) {
          promptToRetry = target.lastPrompt;
        }
      }

      if (!promptToRetry) {
        for (let i = current.length - 1; i >= 0; i--) {
          if (current[i].role === 'user' && current[i].content) {
            promptToRetry = current[i].content;
            break;
          }
        }
      }

      if (promptToRetry) {
        if (assistantMsgId) {
          commitMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        }
        await sendMessage(promptToRetry);
      }
    },
    [commitMessages, sendMessage]
  );

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
  }, [setGenerating]);

  const clearMessages = useCallback(() => {
    commitMessages(() => [createGreeting(`${CLEARED_MESSAGE_ID_PREFIX}${Date.now()}`)]);
  }, [commitMessages]);

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
