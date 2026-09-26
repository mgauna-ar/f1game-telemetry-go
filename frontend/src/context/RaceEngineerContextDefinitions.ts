import { createContext, useContext } from 'react';
import type { ChatContextMode, ChatMessage } from '../types/ai';
import type { ComparatorChatTarget, SessionDebriefChatTarget } from '../utils/chatContext';
import type { AIModelItem } from '../types/generated/ai';

export type { ChatMessage, ComparatorChatTarget, SessionDebriefChatTarget };

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

export type { AIModelItem };

export type ContextMode = ChatContextMode;

/**
 * Callbacks for the AI race engineer. Every one keeps its identity for the provider's lifetime,
 * so components that only act on the chat (the app shell, the pages that set its context) never
 * re-render because of chat state or a streamed reply.
 */
export interface RaceEngineerActionsContextValue {
  openChat: (initialPrompt?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;

  // What the chat is about. The server builds the prompt data from these identifiers.
  setContextMode: (mode: ContextMode) => void;
  setComparatorTarget: (target: ComparatorChatTarget | null) => void;
  setSessionDebriefTarget: (target: SessionDebriefChatTarget | null) => void;

  // Messaging actions
  sendMessage: (customPrompt?: string) => Promise<void>;
  retryLastMessage: (assistantMsgId?: string) => Promise<void>;
  clearMessages: () => void;
  stopGenerating: () => void;

  // Configuration
  saveConfig: (newConfig: AIConfig) => void;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  fetchAvailableModels: (overrideConfig?: AIConfig) => Promise<void>;
}

/** Chat window, context and settings state; changes on user actions, never on a timer. */
export interface RaceEngineerStateContextValue {
  isOpen: boolean;
  contextMode: ContextMode;
  comparatorTarget: ComparatorChatTarget | null;
  sessionDebriefTarget: SessionDebriefChatTarget | null;
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
}

/** The conversation; changes on every streamed chunk. */
export interface RaceEngineerStreamContextValue {
  messages: ChatMessage[];
  isGenerating: boolean;
}

export type RaceEngineerContextValue = RaceEngineerActionsContextValue &
  RaceEngineerStateContextValue &
  RaceEngineerStreamContextValue;

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
export const RaceEngineerStateContext = createContext<RaceEngineerStateContextValue | null>(null);
export const RaceEngineerStreamContext = createContext<RaceEngineerStreamContextValue | null>(null);

const defaultFallbackActionsContext: RaceEngineerActionsContextValue = {
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
  setContextMode: () => {},
  setComparatorTarget: () => {},
  setSessionDebriefTarget: () => {},
  sendMessage: async () => {},
  retryLastMessage: async () => {},
  clearMessages: () => {},
  stopGenerating: () => {},
  saveConfig: () => {},
  saveApiKey: async () => {},
  fetchAvailableModels: async () => {},
};

const defaultFallbackStateContext: RaceEngineerStateContextValue = {
  isOpen: false,
  contextMode: 'general',
  comparatorTarget: null,
  sessionDebriefTarget: null,
  config: DEFAULT_CONFIG,
  keyStatus: NO_AI_KEYS,
  availableModels: [],
  isLoadingModels: false,
  modelsError: null,
};

const defaultFallbackStreamContext: RaceEngineerStreamContextValue = {
  messages: [],
  isGenerating: false,
};

/** Stable chat callbacks. Using only this hook never re-renders a component on chat changes. */
export const useRaceEngineerActions = (): RaceEngineerActionsContextValue =>
  useContext(RaceEngineerActionsContext) ?? defaultFallbackActionsContext;

/** Chat window, context and settings state. */
export const useRaceEngineerState = (): RaceEngineerStateContextValue =>
  useContext(RaceEngineerStateContext) ?? defaultFallbackStateContext;

/** The conversation; re-renders on every streamed chunk. */
export const useRaceEngineerStream = (): RaceEngineerStreamContextValue =>
  useContext(RaceEngineerStreamContext) ?? defaultFallbackStreamContext;

/**
 * @warning Convenience hook combining the actions, state and stream contexts.
 * Because `useRaceEngineerStream` updates on every streaming token received from the LLM,
 * consuming this hook causes the host component to re-render on every token chunk.
 * Prefer `useRaceEngineerActions()` for callbacks, and the state or stream hooks only where
 * that state is rendered.
 */
export const useRaceEngineer = (): RaceEngineerContextValue => {
  const actions = useRaceEngineerActions();
  const state = useRaceEngineerState();
  const stream = useRaceEngineerStream();
  return {
    ...actions,
    ...state,
    ...stream,
  };
};
