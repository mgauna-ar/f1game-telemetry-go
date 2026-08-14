import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Square,
  Settings,
  RotateCcw,
  X,
  Zap,
  Gauge,
  ZoomIn,
  Cpu,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AIConfig {
  provider: 'gemini' | 'openai' | 'custom';
  apiKey: string;
  model: string;
  baseUrl: string;
  providerKeys?: Record<string, string>;
  providerModels?: Record<string, string>;
}

interface AIModelItem {
  id: string;
  display_name: string;
  description?: string;
}

interface AiRaceEngineerProps {
  telemetryContext: TelemetryContextPayload | null;
  hasLapsSelected: boolean;
  isZoomActive: boolean;
}

const STORAGE_KEY_AI_CONFIG = 'f1_ai_engineer_config';

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

export const AiRaceEngineer: React.FC<AiRaceEngineerProps> = ({
  telemetryContext,
  hasLapsSelected,
  isZoomActive,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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

          // Migrate legacy single key/model if present
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

  // Dynamic Models List queried directly from the provider API
  const [availableModels, setAvailableModels] = useState<AIModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Messages & Streaming
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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
          id.includes('moderation')
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

      // 1. Try backend endpoint first
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
        // backend might not be restarted
      }

      // 2. Client-side direct fallback if backend route returned 404
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

  // Fetch models automatically when settings are opened
  useEffect(() => {
    if (showSettings && config.apiKey) {
      fetchAvailableModels();
    }
  }, [showSettings, config.provider, config.apiKey]);

  // Save config
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

  // Scroll messages container to bottom when messages update (without scrolling the outer window/page)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            '👋 **Hello! I am your AI Race Engineer.**\n\nI am ready to analyze comparative telemetry between your laps. I diagnose braking points, corner apex speeds, traction, and ERS/DRS deployment.\n\n*Use the quick action chips below or type your question.*',
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputMessage).trim();
    if (!query || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
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
    setInputMessage('');
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

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          api_key: config.apiKey,
          base_url: config.baseUrl,
          model: config.model,
          messages: apiMessages,
          context: telemetryContext,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (config.provider === 'gemini' && config.apiKey) {
          const systemPrompt = buildSystemPromptText(telemetryContext);
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

        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (status ${res.status})`);
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
                if (parsed.text) {
                  accumulated += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulated } : m
                    )
                  );
                } else if (parsed.error) {
                  const errorMsg =
                    typeof parsed.error === 'string'
                      ? parsed.error
                      : JSON.stringify(parsed.error);
                  accumulated = `⚠️ *Error:* ${errorMsg}\n\n*Please verify your API Key or account quota in Settings (⚙️).*`;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulated } : m
                    )
                  );
                }
              } catch (e) {
                console.warn('Failed to parse SSE line', e);
              }
            }
          }
        }
      }

      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    '⚠️ *No response received from the model.* Please verify that your API Key is valid and has active credit/quota.',
                }
              : m
          )
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'Unknown communication error';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `⚠️ *Error:* ${errMsg}\n\n*Please verify your API Key in Settings (⚙️).*`,
              }
            : m
        )
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleClearChat = () => {
    if (isGenerating) handleStopGeneration();
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          '🔄 **Conversation reset.**\n\nReady for a new analysis. What would you like to inspect on the selected laps?',
        timestamp: new Date(),
      },
    ]);
  };

  const quickPrompts = [
    {
      id: 'delta-loss',
      icon: <Zap size={13} style={{ color: '#ffd200' }} />,
      label: 'Where was time gained/lost?',
      prompt: 'Where was the most time gained or lost between both laps? Provide a technical breakdown by sectors and key corners.',
    },
    {
      id: 'braking-traction',
      icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
      label: 'Braking & Traction',
      prompt: 'Analyze and compare braking points, peak brake pressure, and corner exit traction between both laps.',
    },
    {
      id: 'ers-drs',
      icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
      label: 'ERS & DRS Deployment',
      prompt: 'Compare the electric motor (ERS) deployment strategy and DRS usage between both laps.',
    },
    {
      id: 'zoomed-analysis',
      icon: <ZoomIn size={13} style={{ color: '#38ef7d' }} />,
      label: 'Zoomed Sector',
      prompt: 'Analyze in depth the currently zoomed sector in the telemetry charts and explain the driving difference in detail.',
      requiresZoom: true,
    },
  ];

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="chat-markdown">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} style={{ height: '0.4rem' }} />;
          }

          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="chat-h4">
                {line.substring(4)}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="chat-h3">
                {line.substring(3)}
              </h3>
            );
          }

          if (line.startsWith('* ') || line.startsWith('- ')) {
            return (
              <div key={idx} className="chat-bullet">
                <span className="chat-bullet-dot">•</span>
                <span>{renderInlineMarkdown(line.substring(2))}</span>
              </div>
            );
          }

          return <p key={idx} className="chat-p">{renderInlineMarkdown(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let cur = text;
    let keyIdx = 0;

    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    let lastIdx = 0;

    while ((match = boldRegex.exec(cur)) !== null) {
      if (match.index > lastIdx) {
        parts.push(cur.substring(lastIdx, match.index));
      }
      parts.push(
        <strong key={keyIdx++} style={{ color: '#fff', fontWeight: 600 }}>
          {match[1]}
        </strong>
      );
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < cur.length) {
      parts.push(cur.substring(lastIdx));
    }

    return parts.length > 0 ? parts : text;
  };

  const isConfigured = Boolean(
    config.apiKey ||
      (config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey) ||
      (config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey)
  );

  return (
    <div className="glass-panel ai-embedded-card" style={{ padding: '0.65rem 0.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.4rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bot size={15} style={{ color: '#e10600' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
            AI Race Engineer
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '1px 5px',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
            }}
          >
            {config.model}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn-icon"
            style={{ padding: '3px' }}
            onClick={() => setShowSettings(!showSettings)}
            title="AI Settings"
            aria-label="Settings"
          >
            <Settings size={13} />
          </button>
          <button
            className="btn-icon"
            style={{ padding: '3px' }}
            onClick={handleClearChat}
            title="Clear conversation"
            aria-label="Clear chat"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="ai-settings-card glass-panel" style={{ top: '42px' }}>
          <div className="ai-settings-header">
            <h4>Assistant Settings</h4>
            <button className="btn-icon" onClick={() => setShowSettings(false)}>
              <X size={15} />
            </button>
          </div>

          <div className="ai-settings-body">
            <label className="readout-label">AI Provider</label>
            <select
              className="ui-select"
              value={config.provider}
              onChange={(e) => {
                const prov = e.target.value as AIConfig['provider'];
                const nextKey = config.providerKeys?.[prov] || '';
                const nextModel =
                  config.providerModels?.[prov] ||
                  (prov === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini');

                const updatedConfig: AIConfig = {
                  ...config,
                  provider: prov,
                  apiKey: nextKey,
                  model: nextModel,
                };
                saveConfig(updatedConfig);
                fetchAvailableModels(updatedConfig);
              }}
            >
              <option value="gemini">Google Gemini (Recommended)</option>
              <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
              <option value="custom">OpenAI-Compatible Endpoint (Local / Groq / Ollama)</option>
            </select>

            <label className="readout-label" style={{ marginTop: '0.75rem' }}>
              API Key
              {config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey && (
                <span className="ai-env-badge">Detected on server (.env)</span>
              )}
              {config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey && (
                <span className="ai-env-badge">Detected on server (.env)</span>
              )}
            </label>
            <div className="ai-key-input-wrapper">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="ui-input"
                placeholder={
                  config.provider === 'gemini'
                    ? 'AIzaSy... (or leave empty to use server .env)'
                    : 'sk-... (or leave empty to use server .env)'
                }
                value={config.apiKey}
                onChange={(e) => {
                  const newKey = e.target.value;
                  saveConfig({
                    ...config,
                    apiKey: newKey,
                    providerKeys: {
                      ...(config.providerKeys || {}),
                      [config.provider]: newKey,
                    },
                  });
                }}
              />
              <button
                type="button"
                className="ai-key-toggle-btn"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <small className="ai-settings-hint">
              Saved locally in your browser per provider. Never shared with third parties.
            </small>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', marginBottom: '0.35rem' }}>
              <label className="readout-label" style={{ margin: 0 }}>Model</label>
              <button
                type="button"
                className="ai-refresh-models-btn"
                onClick={() => fetchAvailableModels()}
                disabled={isLoadingModels}
                title="Fetch available models from API"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                }}
              >
                <RefreshCw size={11} className={isLoadingModels ? 'spin-icon' : ''} />
                {isLoadingModels ? 'Fetching...' : 'Refresh models'}
              </button>
            </div>

            {availableModels.length > 0 && (
              <select
                className="ui-select"
                style={{ marginBottom: '0.5rem' }}
                value={availableModels.some((m) => m.id === config.model) ? config.model : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    const newModel = e.target.value;
                    saveConfig({
                      ...config,
                      model: newModel,
                      providerModels: {
                        ...(config.providerModels || {}),
                        [config.provider]: newModel,
                      },
                    });
                  }
                }}
              >
                <option value="" disabled>Select a detected model...</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.id} {m.id !== m.display_name ? `(${m.id})` : ''}
                  </option>
                ))}
                <option value="custom">✏️ Custom / Other...</option>
              </select>
            )}

            {modelsError && (
              <small style={{ color: '#ffd200', fontSize: '0.7rem', marginBottom: '0.4rem', display: 'block' }}>
                ⚠️ {modelsError}
              </small>
            )}

            <input
              type="text"
              className="ui-input"
              value={config.model}
              onChange={(e) => {
                const newModel = e.target.value;
                saveConfig({
                  ...config,
                  model: newModel,
                  providerModels: {
                    ...(config.providerModels || {}),
                    [config.provider]: newModel,
                  },
                });
              }}
              placeholder={config.provider === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini'}
            />

            {config.provider === 'custom' && (
              <>
                <label className="readout-label" style={{ marginTop: '0.75rem' }}>Base URL Endpoint</label>
                <input
                  type="text"
                  className="ui-input"
                  value={config.baseUrl}
                  onChange={(e) => saveConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="http://localhost:11434/v1"
                />
              </>
            )}

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="nav-tab active" onClick={() => setShowSettings(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        className="ai-messages-container"
        style={{ minHeight: '160px', maxHeight: '240px', padding: '0.4rem 0' }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.role === 'assistant' && (
              <div className="ai-msg-avatar" style={{ width: '20px', height: '20px' }}>
                <Bot size={12} />
              </div>
            )}
            <div className={`ai-message-bubble ${msg.role}`} style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem' }}>
              {msg.role === 'assistant' ? (
                msg.content ? (
                  renderFormattedContent(msg.content)
                ) : (
                  <div className="ai-typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                )
              ) : (
                <div className="chat-user-text">{msg.content}</div>
              )}
              <span className="ai-msg-time" style={{ fontSize: '0.6rem' }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="ai-quick-prompts-bar" style={{ padding: '0.25rem 0', background: 'transparent' }}>
        <div className="ai-quick-prompts-scroll">
          {quickPrompts.map((qp) => {
            const disabled = !hasLapsSelected || (qp.requiresZoom && !isZoomActive);
            return (
              <button
                key={qp.id}
                className={`ai-chip-btn ${qp.requiresZoom && isZoomActive ? 'zoom-highlight' : ''}`}
                disabled={disabled || isGenerating}
                onClick={() => handleSendMessage(qp.prompt)}
                title={disabled ? 'Requires two laps selected' : qp.label}
                style={{ fontSize: '0.68rem', padding: '2px 7px', height: '24px' }}
              >
                {qp.icon}
                <span>{qp.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-drawer-footer" style={{ padding: '0.35rem 0 0 0', background: 'transparent', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        {!isConfigured && (
          <div className="ai-unconfigured-alert" style={{ fontSize: '0.68rem', padding: '3px 6px', marginBottom: '0.3rem' }}>
            <span>⚠️ Configure your API Key.</span>
            <button onClick={() => setShowSettings(true)}>Configure</button>
          </div>
        )}

        <form
          className="ai-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            type="text"
            className="ai-chat-input"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', height: '32px' }}
            placeholder={
              !hasLapsSelected
                ? 'Select laps to analyze...'
                : 'Ask your Race Engineer...'
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isGenerating || !hasLapsSelected}
          />

          {isGenerating ? (
            <button
              type="button"
              className="ai-send-btn stop"
              onClick={handleStopGeneration}
              title="Stop response"
              style={{ width: '32px', height: '32px' }}
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              type="submit"
              className="ai-send-btn"
              disabled={!inputMessage.trim() || !hasLapsSelected}
              title="Send message"
              style={{ width: '32px', height: '32px' }}
            >
              <Send size={13} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

function buildSystemPromptText(ctx: TelemetryContextPayload | null): string {
  let prompt =
    'You are the personal F1 Race Engineer and exclusive telemetry analyst for the DRIVER OF LAP A (the primary selected driver).\n' +
    'Your role is to speak directly to your driver (Lap A) over the team radio to analyze their performance, diagnose where lap time was gained or lost, and provide clear, highly technical coaching advice to beat Lap B (the comparison / benchmark lap).\n\n' +
    'CORE COACHING & ROLE RULES:\n' +
    '1. ALWAYS ADDRESS YOUR DRIVER (LAP A) IN THE SECOND PERSON: Use "you", "your lap", "you are braking", "your traction", always referring to the driver of Lap A.\n' +
    '2. LAP B IS STRICTLY THE BENCHMARK / RIVAL: Refer to Lap B as "the benchmark", "Lap B", or by driver B\'s name. NEVER give improvement advice to driver B or act as their engineer.\n' +
    '3. IF YOUR DRIVER (LAP A) IS SLOWER: Explain specifically where they are losing time (e.g. "You are braking 15m too early compared to Lap B into Turn 1", "You lose 0.15s on traction out of the hairpin") and give actionable instructions to recover that delta.\n' +
    '4. IF YOUR DRIVER (LAP A) IS FASTER: Congratulate them on the lap, highlight where they built the advantage over Lap B, and if there are any specific corners where Lap B was stronger, mention them as opportunities to gain even more time.\n' +
    '5. COMMUNICATION STYLE & LANGUAGE: Communicate strictly in English with a professional, sharp, direct F1 team radio tone. Use structured Markdown (bold keywords, bullet points).\n' +
    '6. DO NOT MENTION CAR SETUPS: Setups of other cars are unavailable. Focus 100% on driving technique, braking points, minimum corner apex speed, exit traction, and ERS/DRS deployment.\n\n';

  if (ctx) {
    prompt += `### COMPARATIVE TELEMETRY DATA:\n`;
    prompt += `- Track: ${ctx.track_name} | Session: ${ctx.session_type}\n`;
    prompt += `- YOUR DRIVER (Lap A): ${ctx.lap_a_name} (${ctx.lap_a_time_formatted}) - Compound: ${ctx.lap_a_compound}\n`;
    prompt += `- BENCHMARK / RIVAL (Lap B): ${ctx.lap_b_name} (${ctx.lap_b_time_formatted}) - Compound: ${ctx.lap_b_compound}\n`;
    prompt += `- Total Time Delta: ${ctx.time_delta_seconds.toFixed(3)}s (Faster: ${ctx.faster_lap})\n`;
    prompt += `- Sector Times:\n`;
    prompt += `  * Sector 1: Your time (${ctx.lap_a_s1_formatted}) vs Benchmark (${ctx.lap_b_s1_formatted})\n`;
    prompt += `  * Sector 2: Your time (${ctx.lap_a_s2_formatted}) vs Benchmark (${ctx.lap_b_s2_formatted})\n`;
    prompt += `  * Sector 3: Your time (${ctx.lap_a_s3_formatted}) vs Benchmark (${ctx.lap_b_s3_formatted})\n`;
    prompt += `- Top Speed (Speed Trap): Your speed = ${ctx.top_speed_a.toFixed(1)} km/h | Benchmark = ${ctx.top_speed_b.toFixed(1)} km/h\n`;
    prompt += `- Cumulative ERS Deployment: Your usage = ${ctx.ers_a_used_percent.toFixed(1)}% | Benchmark = ${ctx.ers_b_used_percent.toFixed(1)}%\n`;

    if (ctx.braking_summary) prompt += `- Braking Analysis: ${ctx.braking_summary}\n`;
    if (ctx.apex_speed_summary) prompt += `- Corner Apex Speed: ${ctx.apex_speed_summary}\n`;
    if (ctx.throttle_summary) prompt += `- Traction & Acceleration: ${ctx.throttle_summary}\n`;
    if (ctx.ers_drs_summary) prompt += `- ERS & DRS: ${ctx.ers_drs_summary}\n`;

    if (ctx.zoomed_range) {
      prompt += `\n### ZOOMED SECTOR FOCUSED BY DRIVER (${ctx.zoomed_range.start_distance_meters}m - ${ctx.zoomed_range.end_distance_meters}m):\n`;
      if (ctx.zoomed_range.description) prompt += `- Description: ${ctx.zoomed_range.description}\n`;
      prompt += `- Delta in this segment: ${ctx.zoomed_range.delta_in_segment.toFixed(3)}s\n`;
      prompt += `- Apex speed delta in corner: ${ctx.zoomed_range.speed_diff_at_apex.toFixed(1)} km/h\n`;
    }
  } else {
    prompt += 'Currently, two laps are not selected in the comparator. If the user asks, kindly remind them to select Lap A and Lap B to analyze telemetry.\n';
  }

  return prompt;
}
