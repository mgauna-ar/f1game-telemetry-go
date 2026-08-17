import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AIConfig {
  provider: 'gemini' | 'openai' | 'custom';
  apiKey: string;
  model: string;
  baseUrl: string;
  providerKeys?: Record<string, string>;
  providerModels?: Record<string, string>;
}

export interface AIModelItem {
  id: string;
  display_name: string;
  description?: string;
}

export type ContextMode = 'comparator' | 'session_debrief' | 'live' | 'general';

export interface SessionDebriefContextPayload {
  trackName: string;
  sessionType: string;
  weather?: string;
  driverCount: number;
  summaryText: string;
}

export interface LiveContextPayload {
  trackName: string;
  sessionType?: string;
  safetyCarStatus?: string;
  weatherSummary?: string;
  liveSummary: string;
}

export interface RaceEngineerContextValue {
  isOpen: boolean;
  openChat: (initialPrompt?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  
  contextMode: ContextMode;
  setContextMode: (mode: ContextMode) => void;
  
  // Specific contexts
  comparatorContext: TelemetryContextPayload | null;
  setComparatorContext: (ctx: TelemetryContextPayload | null) => void;
  
  sessionDebriefContext: SessionDebriefContextPayload | null;
  setSessionDebriefContext: (ctx: SessionDebriefContextPayload | null) => void;
  
  liveContext: LiveContextPayload | null;
  setLiveContext: (ctx: LiveContextPayload | null) => void;
  
  // Chat messaging
  messages: ChatMessage[];
  sendMessage: (customPrompt?: string) => Promise<void>;
  clearMessages: () => void;
  isGenerating: boolean;
  stopGenerating: () => void;
  
  // Configuration
  config: AIConfig;
  saveConfig: (newConfig: AIConfig) => void;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (overrideConfig?: AIConfig) => Promise<void>;
  serverConfigStatus: {
    hasGeminiEnvKey: boolean;
    hasOpenAIEnvKey: boolean;
    defaultProvider: string;
    defaultModel: string;
  } | null;
}

const STORAGE_KEY_AI_CONFIG = 'f1_ai_engineer_config';
const STORAGE_KEY_AI_OPEN = 'f1_ai_engineer_open';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-flash-lite-latest',
  baseUrl: '',
  providerKeys: {
    gemini: '',
    openai: '',
    custom: '',
  },
  providerModels: {
    gemini: 'gemini-flash-lite-latest',
    openai: 'gpt-4o-mini',
    custom: 'llama3',
  },
};

const RaceEngineerContext = createContext<RaceEngineerContextValue | null>(null);

const defaultFallbackContext: RaceEngineerContextValue = {
  isOpen: false,
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
  contextMode: 'general',
  setContextMode: () => {},
  comparatorContext: null,
  setComparatorContext: () => {},
  sessionDebriefContext: null,
  setSessionDebriefContext: () => {},
  liveContext: null,
  setLiveContext: () => {},
  messages: [],
  sendMessage: async () => {},
  clearMessages: () => {},
  isGenerating: false,
  stopGenerating: () => {},
  config: DEFAULT_CONFIG,
  saveConfig: () => {},
  availableModels: [],
  isLoadingModels: false,
  modelsError: null,
  fetchAvailableModels: async () => {},
  serverConfigStatus: null,
};

export const useRaceEngineer = (): RaceEngineerContextValue => {
  const context = useContext(RaceEngineerContext);
  if (!context) {
    return defaultFallbackContext;
  }
  return context;
};

export const RaceEngineerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    fetch('/api/ai/config-status')
      .then((res) => res.json())
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

  const saveConfig = (newConfig: AIConfig) => {
    setConfig(newConfig);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_AI_CONFIG, JSON.stringify(newConfig));
      }
    } catch (e) {
      console.warn('Failed to save AI config', e);
    }
  };

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

  const fetchAvailableModels = async (overrideConfig?: AIConfig) => {
    const activeCfg = overrideConfig || config;
    if (!activeCfg.apiKey && !serverConfigStatus?.hasGeminiEnvKey && !serverConfigStatus?.hasOpenAIEnvKey) {
      return;
    }

    setIsLoadingModels(true);
    setModelsError(null);
    try {
      let data: { models: AIModelItem[] } | null = null;

      try {
        const res = await fetch('/api/ai/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeCfg.provider,
            api_key: activeCfg.apiKey,
            base_url: activeCfg.baseUrl,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // Fallback
      }

      if (!data && activeCfg.provider === 'gemini' && activeCfg.apiKey) {
        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${activeCfg.apiKey}`
        );
        if (!directRes.ok) {
          const directErr = await directRes.text();
          throw new Error(directErr || `Google Gemini API Error (${directRes.status})`);
        }
        const gJson = await directRes.json();
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
  };

  const buildCurrentBackendContext = () => {
    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return {
        context_mode: 'session_debrief',
        track_name: sessionDebriefContext.trackName,
        session_type: sessionDebriefContext.sessionType,
        weather_a: sessionDebriefContext.weather,
        session_summary: sessionDebriefContext.summaryText,
      };
    }
    if (contextMode === 'live' && liveContext) {
      return {
        context_mode: 'live',
        track_name: liveContext.trackName,
        session_type: liveContext.sessionType || 'Race',
        live_summary: liveContext.liveSummary,
      };
    }
    if (comparatorContext) {
      return {
        context_mode: 'comparator',
        ...comparatorContext,
      };
    }
    return {
      context_mode: 'general',
    };
  };

  const buildClientSideSystemPrompt = (): string => {
    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return (
        'You are the Chief Race Strategist and Performance Engineer providing an executive post-session debrief of the recorded session.\n' +
        'Analyze overall session classification, driver gaps, pace deltas, tyre stint strategies, degradation, and sector splits across the field.\n\n' +
        'ROLE & COMMUNICATION GUIDELINES:\n' +
        '1. Maintain an analytical, executive F1 engineering debrief tone reviewing the entire session.\n' +
        '2. DO NOT pretend to be an in-car radio talking to a single driver (DO NOT say "Box box", "bringing the car home to P2", etc.) unless the user specifically asks for coaching on a specific driver.\n' +
        '3. Clearly highlight the Winner / Pole Sitter, podium finishers, key gaps, strategy differences (e.g. tyre compounds and stint lengths), and sector records.\n' +
        '4. Always respond in the language used by the user / driver (e.g. Spanish -> Spanish, English -> English).\n' +
        '5. Use structured Markdown with clear headings (## Summary, ## Classification & Gaps, ## Tyre Stints & Strategy, ## Sector Breakdown) and bullet points.\n\n' +
        `### SESSION CLASSIFICATION & TIMING DATA:\n${sessionDebriefContext.summaryText}`
      );
    }
    if (contextMode === 'live' && liveContext) {
      return (
        'You are the active F1 Race Engineer on the pit wall over team radio during a live session.\n' +
        'Provide immediate tactical advice, weather updates, safety car restart strategy, and tyre crossover advice.\n\n' +
        'COMMUNICATION STYLE & ROLE RULES:\n' +
        '1. Maintain an urgent, clear, radio-concise tone suited for real-time in-car communication.\n' +
        '2. Always respond in the language used by the user / driver.\n\n' +
        `### LIVE TELEMETRY DATA:\n${liveContext.liveSummary}`
      );
    }
    if (comparatorContext) {
      let p =
        'You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n' +
        'Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance and give actionable advice to beat Lap B (the benchmark).\n\n' +
        'CORE RULES:\n' +
        '1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON ("you", "your lap").\n' +
        '2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: NEVER coach driver B.\n' +
        '3. FOCUS ON DRIVING TECHNIQUE: Braking points, apex speeds, traction, ERS/DRS.\n' +
        '4. Respond in the language used by the user.\n\n' +
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
      'Always reply in the user\'s language using structured, clear markdown.'
    );
  };

  const sendMessage = async (customPrompt?: string) => {
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
    };

    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);
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

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          api_key: config.apiKey,
          base_url: config.baseUrl,
          model: config.model,
          messages: apiMessages,
          context: backendContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Direct Client-Side Fallback if Gemini
        if (config.provider === 'gemini' && config.apiKey) {
          const systemPrompt = buildClientSideSystemPrompt();
          const geminiContents = apiMessages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

          const cleanModel = config.model.replace(/^models\//, '');
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: geminiContents,
                system_instruction: {
                  parts: [{ text: systemPrompt }],
                },
                generationConfig: {
                  temperature: 0.35,
                },
              }),
              signal: controller.signal,
            }
          );

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini API error (status ${geminiRes.status}): ${errText}`);
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
                          m.id === assistantMsgId ? { ...m, content: accumulated } : m
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

        const errRaw = await res.text().catch(() => '');
        let errMsg = `Server responded with status ${res.status}`;
        try {
          const errJson = JSON.parse(errRaw);
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {
          if (errRaw.trim()) errMsg = errRaw.trim();
        }
        throw new Error(errMsg);
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
                  throw new Error(parsed.error);
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
                      m.id === assistantMsgId ? { ...m, content: accumulated } : m
                    )
                  );
                }
              } catch (e: any) {
                if (e.message && !e.message.includes('JSON')) {
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
        const errMsg = err.message || 'Unknown communication error with AI service.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `⚠️ **Radio Transmission Error:**\n\n${errMsg}\n\n*Please verify your API key and provider configuration in settings.*`,
                }
              : m
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const clearMessages = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          '👋 **Session history cleared.**\n\nI am standing by on the team radio. Select laps in comparator, inspect sessions, or ask any telemetry questions.',
        timestamp: new Date(),
      },
    ]);
  };

  const openChat = (initialPrompt?: string) => {
    setIsOpen(true);
    if (initialPrompt && initialPrompt.trim()) {
      setTimeout(() => {
        sendMessage(initialPrompt);
      }, 50);
    }
  };

  const closeChat = () => {
    setIsOpen(false);
  };

  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };

  const value = useMemo<RaceEngineerContextValue>(() => ({
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
    messages,
    sendMessage,
    clearMessages,
    isGenerating,
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
    contextMode,
    comparatorContext,
    sessionDebriefContext,
    liveContext,
    messages,
    isGenerating,
    config,
    availableModels,
    isLoadingModels,
    modelsError,
    serverConfigStatus,
  ]);

  return (
    <RaceEngineerContext.Provider value={value}>
      {children}
    </RaceEngineerContext.Provider>
  );
};
