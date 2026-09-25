import { createContext, useContext } from 'react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import type { ChatMessage } from '../types/ai';

export type { ChatMessage };

export type AIProvider = 'gemini' | 'openai' | 'claude' | 'custom';

export const AI_PROVIDERS: readonly AIProvider[] = ['gemini', 'openai', 'claude', 'custom'];

export interface AIProviderOption {
  provider: AIProvider;
  /** Short name, like "Gemini". */
  nameKey: string;
  /** One line under the name: who runs it and what it costs. */
  taglineKey: string;
}

/** Providers offered in the AI settings, in the order they are shown. */
export const AI_PROVIDER_OPTIONS: ReadonlyArray<AIProviderOption> = [
  { provider: 'gemini', nameKey: 'ai_engineer.providers.gemini.name', taglineKey: 'ai_engineer.providers.gemini.tagline' },
  { provider: 'openai', nameKey: 'ai_engineer.providers.openai.name', taglineKey: 'ai_engineer.providers.openai.tagline' },
  { provider: 'claude', nameKey: 'ai_engineer.providers.claude.name', taglineKey: 'ai_engineer.providers.claude.tagline' },
  { provider: 'custom', nameKey: 'ai_engineer.providers.custom.name', taglineKey: 'ai_engineer.providers.custom.tagline' },
];

export const isAIProvider = (value: unknown): value is AIProvider =>
  typeof value === 'string' && (AI_PROVIDERS as readonly string[]).includes(value);

/**
 * The AI chat provider setup. It is saved on the server and shared by every device; API keys are
 * saved there too but never sent back, so only `AIKeyStatus` reaches the browser.
 */
export interface AIConfig {
  provider: AIProvider;
  /** Model of the active provider. */
  model: string;
  /** Endpoint of the OpenAI-compatible custom provider. */
  baseUrl: string;
  providerModels: Record<AIProvider, string>;
}

/** Whether the server has an API key for a provider, saved from the dashboard or from .env. */
export interface AIKeyStatus {
  hasSavedKey: boolean;
  hasEnvKey: boolean;
}

export type AIKeyStatusByProvider = Record<AIProvider, AIKeyStatus>;

/** Whether chats with the provider can run: custom endpoints (like Ollama) may not need a key. */
export const providerHasKey = (keyStatus: AIKeyStatusByProvider, provider: AIProvider): boolean =>
  provider === 'custom' || keyStatus[provider].hasSavedKey || keyStatus[provider].hasEnvKey;

/** Whether the provider is set up enough to chat: a key for cloud providers, an address for custom. */
export const providerIsReady = (config: AIConfig, keyStatus: AIKeyStatusByProvider, provider: AIProvider): boolean =>
  provider === 'custom' ? config.baseUrl.trim() !== '' : providerHasKey(keyStatus, provider);

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

export interface RaceEngineerActionsContextValue {
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
  
  // Messaging actions
  sendMessage: (customPrompt?: string) => Promise<void>;
  retryLastMessage: (assistantMsgId?: string) => Promise<void>;
  clearMessages: () => void;
  stopGenerating: () => void;
  
  // Configuration
  config: AIConfig;
  saveConfig: (newConfig: AIConfig) => void;
  keyStatus: AIKeyStatusByProvider;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (overrideConfig?: AIConfig) => Promise<void>;
}

export interface RaceEngineerStreamContextValue {
  messages: ChatMessage[];
  isGenerating: boolean;
}

export type RaceEngineerContextValue = RaceEngineerActionsContextValue & RaceEngineerStreamContextValue;

/** Where older versions kept the AI config, keys included, in each browser. Read once to migrate it. */
export const STORAGE_KEY_AI_CONFIG = 'f1_ai_engineer_config';
export const STORAGE_KEY_AI_OPEN = 'f1_ai_engineer_open';
/** Whether the chat window is shown large on this browser. */
export const STORAGE_KEY_AI_EXPANDED = 'f1_ai_engineer_expanded';

/**
 * Placeholder until the server's settings load. Default model names come from the server, so the
 * model is left empty here and the server fills in its default for an empty model.
 */
export const DEFAULT_CONFIG: AIConfig = {
  provider: 'gemini',
  model: '',
  baseUrl: '',
  providerModels: { gemini: '', openai: '', claude: '', custom: '' },
};

export const NO_AI_KEYS: AIKeyStatusByProvider = {
  gemini: { hasSavedKey: false, hasEnvKey: false },
  openai: { hasSavedKey: false, hasEnvKey: false },
  claude: { hasSavedKey: false, hasEnvKey: false },
  custom: { hasSavedKey: false, hasEnvKey: false },
};

export const RaceEngineerActionsContext = createContext<RaceEngineerActionsContextValue | null>(null);
export const RaceEngineerStreamContext = createContext<RaceEngineerStreamContextValue | null>(null);
export const RaceEngineerContext = RaceEngineerActionsContext;

const defaultFallbackActionsContext: RaceEngineerActionsContextValue = {
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
  sendMessage: async () => {},
  retryLastMessage: async () => {},
  clearMessages: () => {},
  stopGenerating: () => {},
  config: DEFAULT_CONFIG,
  saveConfig: () => {},
  keyStatus: NO_AI_KEYS,
  saveApiKey: async () => {},
  availableModels: [],
  isLoadingModels: false,
  modelsError: null,
  fetchAvailableModels: async () => {},
};

const defaultFallbackStreamContext: RaceEngineerStreamContextValue = {
  messages: [],
  isGenerating: false,
};

export const useRaceEngineerActions = (): RaceEngineerActionsContextValue => {
  const context = useContext(RaceEngineerActionsContext);
  if (!context) {
    return defaultFallbackActionsContext;
  }
  return context;
};

export const useRaceEngineerStream = (): RaceEngineerStreamContextValue => {
  const context = useContext(RaceEngineerStreamContext);
  if (!context) {
    return defaultFallbackStreamContext;
  }
  return context;
};

/**
 * @warning Convenience hook combining action and stream contexts.
 * Because `useRaceEngineerStream` updates on every streaming token received from the LLM,
 * consuming this hook causes the host component to re-render on every token chunk.
 * For optimal render performance, prefer `useRaceEngineerActions()` for action callbacks
 * and `useRaceEngineerStream()` only where live streaming state is actively rendered.
 */
export const useRaceEngineer = (): RaceEngineerContextValue => {
  const actions = useRaceEngineerActions();
  const stream = useRaceEngineerStream();
  return {
    ...actions,
    ...stream,
  };
};

