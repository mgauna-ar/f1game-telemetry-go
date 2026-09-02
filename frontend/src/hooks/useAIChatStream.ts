import { useState, useRef, useCallback } from 'react';
import { api } from '../utils/apiClient';
import type { AIConfig, ChatMessage } from '../context/RaceEngineerContext';
import type { ServerConfigStatus } from './useAIModels';
import type { BackendContextPayload } from './useSystemPrompt';

export interface UseAIChatStreamProps {
  config: AIConfig;
  serverConfigStatus: ServerConfigStatus | null;
  buildCurrentBackendContext: () => BackendContextPayload;
  buildClientSideSystemPrompt: () => string;
}

export interface UseAIChatStreamReturn {
  messages: ChatMessage[];
  isGenerating: boolean;
  sendMessage: (customPrompt?: string) => Promise<void>;
  retryLastMessage: (assistantMsgId?: string) => Promise<void>;
  stopGenerating: () => void;
  clearMessages: () => void;
}

interface CustomStreamError extends Error {
  errorCode?: string;
  provider?: string;
}

interface GeminiSSECandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiSSEResponse {
  candidates?: GeminiSSECandidate[];
}

interface BackendSSEChunk {
  error?: string;
  code?: string;
  provider?: string;
  text?: string;
  content?: string;
  delta?: { content?: string };
  candidates?: GeminiSSECandidate[];
}

export const useAIChatStream = ({
  config,
  serverConfigStatus,
  buildCurrentBackendContext,
  buildClientSideSystemPrompt,
}: UseAIChatStreamProps): UseAIChatStreamReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 **Hello! I am your AI Race Engineer.**\n\nI am connected to your telemetry feed across Session History, Lap Comparator, and Live Sessions.\n\n*Use the quick prompt chips below or ask me any question about your driving deltas, braking points, or race strategy.*',
      timestamp: new Date(),
    },
  ]);

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

      // Pre-check if API key is missing before making network requests
      const hasServerKey =
        (config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey) ||
        (config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey);

      if (!config.apiKey && !hasServerKey && config.provider !== 'custom') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: '',
                  errorCode: 'MISSING_API_KEY',
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
          .filter((m) => m.id !== 'welcome' && m.id !== assistantMsgId)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const backendContext = buildCurrentBackendContext();

        const res = await api.stream(
          '/api/ai/chat',
          {
            provider: config.provider,
            api_key: config.apiKey,
            base_url: config.baseUrl,
            model: config.model,
            messages: apiMessages,
            context: backendContext,
          },
          controller.signal
        );

        if (!res.ok) {
          let errCode = 'GENERIC_ERROR';
          let errMsg = `Server responded with status ${res.status}`;
          let errProvider = config.provider;
          let isStructuredAIError = false;

          const errRaw = await res.text().catch(() => '');
          try {
            const errJson = JSON.parse(errRaw);
            errMsg = errJson.message || errJson.error || errMsg;
            if (errJson.code) {
              errCode = errJson.code;
              isStructuredAIError = true;
            }
            if (errJson.provider) errProvider = errJson.provider;
          } catch {
            if (errRaw.trim()) errMsg = errRaw.trim();
          }

          // Direct Client-Side Fallback only if Gemini and backend API route is not implemented (e.g. standalone static SPA 404/502)
          if (
            config.provider === 'gemini' &&
            config.apiKey &&
            !isStructuredAIError &&
            (res.status === 404 || res.status === 502)
          ) {
            const systemPrompt = buildClientSideSystemPrompt();
            const geminiContents = apiMessages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            }));

            const cleanModel = config.model.replace(/^models\//, '');
            const geminiRes = await api.stream(
              `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
              {
                contents: geminiContents,
                system_instruction: {
                  parts: [{ text: systemPrompt }],
                },
                generationConfig: {
                  temperature: 0.35,
                },
              },
              controller.signal
            );

            if (!geminiRes.ok) {
              const errText = await geminiRes.text();
              let parsedGeminiErr = `Gemini API error (${geminiRes.status})`;
              let gCode = 'GENERIC_ERROR';
              try {
                const gJson = JSON.parse(errText);
                parsedGeminiErr = gJson.error?.message || parsedGeminiErr;
                const gStatus = gJson.error?.status;
                if (
                  geminiRes.status === 503 ||
                  gStatus === 'UNAVAILABLE' ||
                  parsedGeminiErr.toLowerCase().includes('overloaded')
                ) {
                  gCode = 'MODEL_OVERLOADED';
                } else if (
                  geminiRes.status === 429 ||
                  gStatus === 'RESOURCE_EXHAUSTED' ||
                  parsedGeminiErr.toLowerCase().includes('quota')
                ) {
                  gCode = 'QUOTA_EXCEEDED';
                } else if (
                  geminiRes.status === 400 ||
                  geminiRes.status === 401 ||
                  geminiRes.status === 403
                ) {
                  gCode = 'INVALID_API_KEY';
                } else if (geminiRes.status === 404) {
                  gCode = 'MODEL_NOT_FOUND';
                }
              } catch {
                // Ignore JSON parse error
              }
              const customErr: CustomStreamError = new Error(parsedGeminiErr);
              customErr.errorCode = gCode;
              customErr.provider = 'gemini';
              throw customErr;
            }

            const reader = geminiRes.body?.getReader();
            const decoder = new TextDecoder('utf-8');
            let accumulated = '';

            if (reader) {
              let buffer = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.substring(6);
                    if (dataStr === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(dataStr) as GeminiSSEResponse;
                      const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (chunk) {
                        accumulated += chunk;
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === assistantMsgId
                              ? { ...m, content: accumulated, errorCode: undefined }
                              : m
                          )
                        );
                      }
                    } catch (e) {
                      console.warn('Failed to parse SSE JSON chunk', e);
                    }
                  }
                }
              }
            }
            return;
          }

          const customErr: CustomStreamError = new Error(errMsg);
          customErr.errorCode = errCode;
          customErr.provider = errProvider;
          throw customErr;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.substring(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr) as BackendSSEChunk;
                  if (parsed.error) {
                    const customErr: CustomStreamError = new Error(parsed.error);
                    customErr.errorCode = parsed.code || 'GENERIC_ERROR';
                    customErr.provider = parsed.provider || config.provider;
                    throw customErr;
                  }
                  const chunkText =
                    parsed.text ??
                    parsed.content ??
                    parsed.delta?.content ??
                    parsed.candidates?.[0]?.content?.parts?.[0]?.text ??
                    '';
                  if (chunkText) {
                    accumulated += chunkText;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: accumulated, errorCode: undefined }
                          : m
                      )
                    );
                  }
                } catch (e: unknown) {
                  const errObj = e as CustomStreamError;
                  if (errObj.errorCode || (errObj.message && !errObj.message.includes('JSON'))) {
                    throw e;
                  }
                }
              }
            }
          }
        }

        if (!accumulated.trim()) {
          throw new Error(
            'Received empty response from AI model. Please verify your selected model or API configuration.'
          );
        }
      } catch (err: unknown) {
        const errorObj = err as CustomStreamError;
        if (errorObj.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + '\n\n*(Analysis stopped by user)*' }
                : m
            )
          );
        } else {
          let code = errorObj.errorCode;
          const errMsg = errorObj.message || 'Unknown communication error with AI service.';
          const lowerMsg = errMsg.toLowerCase();

          if (!code) {
            if (
              lowerMsg.includes('overloaded') ||
              lowerMsg.includes('high demand') ||
              lowerMsg.includes('503')
            ) {
              code = 'MODEL_OVERLOADED';
            } else if (
              lowerMsg.includes('quota') ||
              lowerMsg.includes('rate limit') ||
              lowerMsg.includes('429')
            ) {
              code = 'QUOTA_EXCEEDED';
            } else if (
              lowerMsg.includes('api key') ||
              lowerMsg.includes('unauthorized') ||
              lowerMsg.includes('401') ||
              lowerMsg.includes('key not valid')
            ) {
              code = 'INVALID_API_KEY';
            } else if (lowerMsg.includes('not found') || lowerMsg.includes('404')) {
              code = 'MODEL_NOT_FOUND';
            } else if (
              errorObj.name === 'TypeError' ||
              lowerMsg.includes('failed to fetch') ||
              lowerMsg.includes('network')
            ) {
              code = 'NETWORK_ERROR';
            } else {
              code = 'GENERIC_ERROR';
            }
          }

          const canRetry =
            code === 'MODEL_OVERLOADED' || code === 'NETWORK_ERROR' || code === 'GENERIC_ERROR';

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: '',
                    errorCode: code,
                    errorProvider: errorObj.provider || config.provider,
                    errorRaw: errMsg,
                    canRetry,
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
      buildClientSideSystemPrompt,
      buildCurrentBackendContext,
      config,
      isGenerating,
      messages,
      serverConfigStatus,
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
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          '👋 **Session history cleared.**\n\nI am standing by on the team radio. Select laps in comparator, inspect sessions, or ask any telemetry questions.',
        timestamp: new Date(),
      },
    ]);
  }, []);

  return {
    messages,
    isGenerating,
    sendMessage,
    retryLastMessage,
    stopGenerating,
    clearMessages,
  };
};
