import { createContext, useContext } from 'react';
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

export const STORAGE_KEY_AI_CONFIG = 'f1_ai_engineer_config';
export const STORAGE_KEY_AI_OPEN = 'f1_ai_engineer_open';

export const DEFAULT_CONFIG: AIConfig = {
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

export const RaceEngineerContext = createContext<RaceEngineerContextValue | null>(null);

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
