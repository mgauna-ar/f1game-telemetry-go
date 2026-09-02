import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { useI18n } from './I18nContext';
import { api } from '../utils/apiClient';
import {
  RaceEngineerActionsContext,
  RaceEngineerStreamContext,
  DEFAULT_CONFIG,
  STORAGE_KEY_AI_CONFIG,
  STORAGE_KEY_AI_OPEN,
  type ChatMessage,
  type AIConfig,
  type AIModelItem,
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
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_AI_OPEN);
        if (saved !== null) {
          return saved === 'true';
        }
      }
    } catch {
      // Ignore
    }
    return false;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_AI_OPEN, String(isOpen));
      }
    } catch {
      // Ignore
    }
  }, [isOpen]);

  // Active contexts
  const [contextMode, setContextMode] = useState<ContextMode>('general');
  const [comparatorContext, setComparatorContext] = useState<TelemetryContextPayload | null>(null);
  const [sessionDebriefContext, setSessionDebriefContext] = useState<SessionDebriefContextPayload | null>(null);
  const [liveContext, setLiveContext] = useState<LiveContextPayload | null>(null);

  // Configuration
  const [config, setConfig] = useState<AIConfig>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_AI_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
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
      }
    } catch (e) {
      console.warn('Failed to load AI config from localStorage', e);
    }
    return DEFAULT_CONFIG;
  });

  const [serverConfigStatus, setServerConfigStatus] = useState<{
    hasGeminiEnvKey: boolean;
    hasOpenAIEnvKey: boolean;
    defaultProvider: string;
    defaultModel: string;
  } | null>(null);

  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Messages & Streaming
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 **Hello! I am your AI Race Engineer.**\n\nI am connected to your telemetry feed across Session History, Lap Comparator, and Live Sessions.\n\n*Use the quick prompt chips below or ask me any question about your driving deltas, braking points, or race strategy.*',
      timestamp: new Date(),
    },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      .catch((err) => console.warn('Could not fetch AI config status', err));
  }, []);

  const saveConfig = useCallback((newConfig: AIConfig) => {
    setConfig(newConfig);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(newConfig));
      }
    } catch (e) {
      console.warn('Failed to save AI config', e);
    }
  }, []);

  const filterChatModels = (rawModels: AIModelItem[], provider: string): AIModelItem[] => {
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

  const fetchAvailableModels = useCallback(async (overrideConfig?: AIConfig) => {
    const activeCfg = overrideConfig || config;
    if (!activeCfg.apiKey && !serverConfigStatus?.hasGeminiEnvKey && !serverConfigStatus?.hasOpenAIEnvKey) {
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
        // Fallback
      }

      if (!data && activeCfg.provider === 'gemini' && activeCfg.apiKey) {
        const gJson = await api.get<{ models?: any[] }>(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${activeCfg.apiKey}`
        );
        const gModels: AIModelItem[] = (gJson.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m: any) => ({
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
    } catch (err: any) {
      setModelsError(err.message || 'Could not query models list.');
    } finally {
      setIsLoadingModels(false);
    }
  }, [config, serverConfigStatus]);

  const buildCurrentBackendContext = useCallback(() => {
    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return {
        context_mode: 'session_debrief',
        language: locale,
        track_name: sessionDebriefContext.trackName,
        session_type: sessionDebriefContext.sessionType,
        weather_a: sessionDebriefContext.weather,
        session_summary: sessionDebriefContext.summaryText,
      };
    }
    if (contextMode === 'live') {
      return {
        context_mode: 'live',
        language: locale,
        track_name: liveContext?.trackName || '',
        session_type: liveContext?.sessionType || 'Live Session',
        live_summary: liveContext?.liveSummary || 'Live pit wall telemetry standby. Awaiting live packet stream from game.',
      };
    }
    if (contextMode === 'comparator' && comparatorContext) {
      return {
        context_mode: 'comparator',
        language: locale,
        ...comparatorContext,
      };
    }
    return {
      context_mode: 'general',
      language: locale,
    };
  }, [contextMode, sessionDebriefContext, locale, liveContext, comparatorContext]);

  const buildClientSideSystemPrompt = useCallback((): string => {
    const langInstruction =
      locale === 'es'
        ? 'Always respond in Spanish (Latin America / Argentina motorsport terminology e.g. neumáticos, boxes, monoplaza, vuelta rápida).'
        : 'Always respond in English.';

    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return (
        'You are the Chief Race Strategist and Performance Engineer providing an executive post-session debrief of the recorded session.\n' +
        'Analyze overall session classification, driver gaps, pace deltas, tyre stint strategies, degradation, and sector splits across the field.\n\n' +
        'ROLE & COMMUNICATION GUIDELINES:\n' +
        '1. Maintain an analytical, executive F1 engineering debrief tone reviewing the entire session.\n' +
        '2. DO NOT pretend to be an in-car radio talking to a single driver (DO NOT say "Box box", "bringing the car home to P2", etc.) unless the user specifically asks for coaching on a specific driver.\n' +
        '3. Clearly highlight the Winner / Pole Sitter, podium finishers, key gaps, strategy differences (e.g. tyre compounds and stint lengths), and sector records.\n' +
        `4. ${langInstruction}\n` +
        '5. Use structured Markdown with clear headings (## Summary, ## Classification & Gaps, ## Tyre Stints & Strategy, ## Sector Breakdown) and bullet points.\n\n' +
        `### SESSION CLASSIFICATION & TIMING DATA:\n${sessionDebriefContext.summaryText}`
      );
    }
    if (contextMode === 'live') {
      const isStandby = !liveContext || liveContext.sessionType === 'Standby' || !liveContext.liveSummary || liveContext.liveSummary.includes('STANDBY') || liveContext.liveSummary.includes('Waiting for live');
      const liveData = !isStandby
        ? `\n\n### LIVE TELEMETRY DATA:\n${liveContext?.liveSummary}`
        : '\n\n### LIVE STATUS: STANDBY / IN GARAGE (NO TELEMETRY PACKETS YET)\nNo live telemetry packets received from track yet. Live weather radar, tyre temperatures, and gap deltas are currently unavailable.\nCRITICAL: DO NOT invent fake rain percentages, temperatures, or stint data. Inform the driver directly that we are standing by in the garage/pit wall waiting for live track telemetry.';

      const antiHallucination =
        locale === 'es'
          ? '\n3. CERO ALUCINACIONES: Si estamos en espera en boxes (sin telemetría activa de pista), indicá que estamos en espera y que aún no hay datos de radar o pista disponibles. No inventes números ni porcentajes.'
          : '\n3. NO TELEMETRY HALLUCINATIONS: If in garage/standby with no live telemetry, state that we are standing by and live data is not yet available. Do not invent numbers or weather percentages.';

      return (
        'You are the active F1 Race Engineer on the pit wall over team radio during a live session.\n' +
        'Provide immediate tactical advice, weather updates, safety car restart strategy, and tyre crossover advice.\n\n' +
        'COMMUNICATION STYLE & ROLE RULES:\n' +
        '1. Maintain an urgent, clear, radio-concise tone suited for real-time in-car communication.\n' +
        `2. ${langInstruction}${antiHallucination}${liveData}`
      );
    }
    if (contextMode === 'comparator' && comparatorContext) {
      let p =
        'You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n' +
        'Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance and give actionable advice to beat Lap B (the benchmark).\n\n' +
        'CORE RULES:\n' +
        '1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON ("you", "your lap").\n' +
        '2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: NEVER coach driver B.\n' +
        '3. FOCUS ON DRIVING TECHNIQUE: Braking points, apex speeds, traction, ERS/DRS.\n' +
        `4. ${langInstruction}\n\n` +
        `### COMPARATIVE TELEMETRY:\n` +
        `- Track: ${comparatorContext.track_name} | Session: ${comparatorContext.session_type}\n` +
        `- YOUR DRIVER (Lap A): ${comparatorContext.lap_a_name} (${comparatorContext.lap_a_time_formatted}) - ${comparatorContext.lap_a_compound}\n` +
        `- BENCHMARK (Lap B): ${comparatorContext.lap_b_name} (${comparatorContext.lap_b_time_formatted}) - ${comparatorContext.lap_b_compound}\n` +
        `- Delta: ${comparatorContext.time_delta_seconds.toFixed(3)}s (Faster: ${comparatorContext.faster_lap})\n` +
        `- Sectors: S1 (${comparatorContext.lap_a_s1_formatted} vs ${comparatorContext.lap_b_s1_formatted}), S2 (${comparatorContext.lap_a_s2_formatted} vs ${comparatorContext.lap_b_s2_formatted}), S3 (${comparatorContext.lap_a_s3_formatted} vs ${comparatorContext.lap_b_s3_formatted})\n` +
        `- Top Speed: ${comparatorContext.top_speed_a.toFixed(1)} km/h vs ${comparatorContext.top_speed_b.toFixed(1)} km/h\n` +
        `- ERS Usage: ${comparatorContext.ers_a_used_percent.toFixed(1)}% vs ${comparatorContext.ers_b_used_percent.toFixed(1)}%\n`;

      if (comparatorContext.braking_summary) p += `- Braking: ${comparatorContext.braking_summary}\n`;
      if (comparatorContext.apex_speed_summary) p += `- Corner Apex Speed: ${comparatorContext.apex_speed_summary}\n`;
      if (comparatorContext.throttle_summary) p += `- Traction: ${comparatorContext.throttle_summary}\n`;
      if (comparatorContext.ers_drs_summary) p += `- ERS & DRS: ${comparatorContext.ers_drs_summary}\n`;

      if (comparatorContext.zoomed_range) {
        p += `\n### ZOOMED SECTOR (${comparatorContext.zoomed_range.start_distance_meters}m - ${comparatorContext.zoomed_range.end_distance_meters}m):\n`;
        if (comparatorContext.zoomed_range.description) p += `- Segment: ${comparatorContext.zoomed_range.description}\n`;
        p += `- Delta in segment: ${comparatorContext.zoomed_range.delta_in_segment.toFixed(3)}s\n`;
      }
      return p;
    }

    return (
      'You are the personal F1 Race Engineer.\n' +
      'Help the driver with telemetry analysis, driving coaching, setup theory, and racing strategy.\n' +
      `${langInstruction} Use structured, clear markdown.`
    );
  }, [comparatorContext, contextMode, liveContext, locale, sessionDebriefContext]);

  const sendMessage = useCallback(async (customPrompt?: string) => {
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

      const res = await api.stream('/api/ai/chat', {
        provider: config.provider,
        api_key: config.apiKey,
        base_url: config.baseUrl,
        model: config.model,
        messages: apiMessages,
        context: backendContext,
      }, controller.signal);

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
        if (config.provider === 'gemini' && config.apiKey && !isStructuredAIError && (res.status === 404 || res.status === 502)) {
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
              if (geminiRes.status === 503 || gStatus === 'UNAVAILABLE' || parsedGeminiErr.toLowerCase().includes('overloaded')) {
                gCode = 'MODEL_OVERLOADED';
              } else if (geminiRes.status === 429 || gStatus === 'RESOURCE_EXHAUSTED' || parsedGeminiErr.toLowerCase().includes('quota')) {
                gCode = 'QUOTA_EXCEEDED';
              } else if (geminiRes.status === 400 || geminiRes.status === 401 || geminiRes.status === 403) {
                gCode = 'INVALID_API_KEY';
              } else if (geminiRes.status === 404) {
                gCode = 'MODEL_NOT_FOUND';
              }
            } catch {
              // Ignore json parse
            }
            const customErr: any = new Error(parsedGeminiErr);
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
                    const parsed = JSON.parse(dataStr);
                    const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (chunk) {
                      accumulated += chunk;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: accumulated, errorCode: undefined } : m
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

        const customErr: any = new Error(errMsg);
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
                const parsed = JSON.parse(dataStr);
                if (parsed.error) {
                  const customErr: any = new Error(parsed.error);
                  customErr.errorCode = parsed.code || 'GENERIC_ERROR';
                  customErr.provider = parsed.provider || config.provider;
                  throw customErr;
                }
                const chunkText =
                  parsed.text ??
                  parsed.content ??
                  parsed.delta?.content ??
                  (parsed.candidates?.[0]?.content?.parts?.[0]?.text) ??
                  '';
                if (chunkText) {
                  accumulated += chunkText;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulated, errorCode: undefined } : m
                    )
                  );
                }
              } catch (e: any) {
                if (e.errorCode || (e.message && !e.message.includes('JSON'))) {
                  throw e;
                }
              }
            }
          }
        }
      }

      if (!accumulated.trim()) {
        throw new Error('Received empty response from AI model. Please verify your selected model or API configuration.');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + '\n\n*(Analysis stopped by user)*' }
              : m
          )
        );
      } else {
        let code = err.errorCode;
        const errMsg = err.message || 'Unknown communication error with AI service.';
        const lowerMsg = errMsg.toLowerCase();

        if (!code) {
          if (lowerMsg.includes('overloaded') || lowerMsg.includes('high demand') || lowerMsg.includes('503')) {
            code = 'MODEL_OVERLOADED';
          } else if (lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('429')) {
            code = 'QUOTA_EXCEEDED';
          } else if (lowerMsg.includes('api key') || lowerMsg.includes('unauthorized') || lowerMsg.includes('401') || lowerMsg.includes('key not valid')) {
            code = 'INVALID_API_KEY';
          } else if (lowerMsg.includes('not found') || lowerMsg.includes('404')) {
            code = 'MODEL_NOT_FOUND';
          } else if (err.name === 'TypeError' || lowerMsg.includes('failed to fetch') || lowerMsg.includes('network')) {
            code = 'NETWORK_ERROR';
          } else {
            code = 'GENERIC_ERROR';
          }
        }

        const canRetry = code === 'MODEL_OVERLOADED' || code === 'NETWORK_ERROR' || code === 'GENERIC_ERROR';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: '',
                  errorCode: code,
                  errorProvider: err.provider || config.provider,
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
  }, [buildClientSideSystemPrompt, buildCurrentBackendContext, config, isGenerating, messages, serverConfigStatus]);

  const retryLastMessage = useCallback(async (assistantMsgId?: string) => {
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
  }, [isGenerating, messages, sendMessage]);

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

  const openChat = useCallback((initialPrompt?: string) => {
    setIsOpen(true);
    if (initialPrompt && initialPrompt.trim()) {
      setTimeout(() => {
        sendMessage(initialPrompt);
      }, 50);
    }
  }, [sendMessage]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const actionsValue = useMemo<RaceEngineerActionsContextValue>(() => ({
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
  }), [
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
  ]);

  const streamValue = useMemo<RaceEngineerStreamContextValue>(() => ({
    messages,
    isGenerating,
  }), [messages, isGenerating]);

  return (
    <RaceEngineerActionsContext.Provider value={actionsValue}>
      <RaceEngineerStreamContext.Provider value={streamValue}>
        {children}
      </RaceEngineerStreamContext.Provider>
    </RaceEngineerActionsContext.Provider>
  );
};
