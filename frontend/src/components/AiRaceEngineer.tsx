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
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
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
  model: 'gemini-1.5-flash',
  baseUrl: '',
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
          if (parsed.model === 'gemini-2.0-flash' || parsed.model === 'gemini-2.5-flash') {
            parsed.model = 'gemini-1.5-flash';
          }
          return { ...DEFAULT_CONFIG, ...parsed };
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

  // Dynamic Models List
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
          throw new Error(directErr || `Error de Google Gemini (${directRes.status})`);
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
        setAvailableModels(data.models);
      } else {
        setAvailableModels([]);
      }
    } catch (err: any) {
      setModelsError(err.message || 'No se pudieron obtener los modelos.');
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
            '👋 **¡Hola! Soy tu AI Race Engineer.**\n\nEstoy listo para analizar la telemetría comparativa entre tus vueltas. Analizo puntos de frenada, velocidad de ápice en curvas, tracción y despliegue de ERS y DRS.\n\n*Usa las acciones rápidas abajo o escribe tu pregunta.*',
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
      // Build conversation history for the API
      const apiMessages = nextMessages
        .filter((m) => m.id !== 'welcome' && m.id !== assistantMsgId)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      let res: Response | null = null;

      // 1. Try Go backend endpoint first
      try {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: config.provider,
            api_key: config.apiKey,
            base_url: config.baseUrl,
            model: config.model || (config.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'),
            messages: apiMessages,
            context: telemetryContext,
          }),
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        // fallback
      }

      // 2. Direct fallback to Google Gemini API if backend returned 404 (not restarted)
      if ((!res || res.status === 404) && config.provider === 'gemini' && config.apiKey) {
        const modelClean = (config.model || 'gemini-1.5-flash').replace('models/', '');
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelClean}:streamGenerateContent?alt=sse&key=${config.apiKey}`;

        const systemText = buildSystemPromptText(telemetryContext);
        const geminiContents = apiMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        res = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemText }],
            },
            contents: geminiContents,
            generationConfig: { temperature: 0.4 },
          }),
          signal: controller.signal,
        });
      }

      if (!res || !res.ok) {
        let errText = 'Error en la solicitud de IA';
        try {
          const errJson = await res?.text();
          errText = errJson || errText;
        } catch {
          // fallback
        }
        throw new Error(errText);
      }

      if (!res.body) {
        throw new Error('No readable stream received');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const dataObj = JSON.parse(dataStr);
              let chunkText = '';
              if (dataObj.text) {
                chunkText = dataObj.text;
              } else if (dataObj.candidates?.[0]?.content?.parts?.[0]?.text) {
                chunkText = dataObj.candidates[0].content.parts[0].text;
              } else if (dataObj.choices?.[0]?.delta?.content) {
                chunkText = dataObj.choices[0].delta.content;
              }

              if (chunkText) {
                streamedContent += chunkText;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: streamedContent } : msg
                  )
                );
              } else if (dataObj.error) {
                streamedContent += `\n\n⚠️ *Error:* ${typeof dataObj.error === 'object' ? dataObj.error.message || JSON.stringify(dataObj.error) : dataObj.error}`;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: streamedContent } : msg
                  )
                );
              }
            } catch {
              // Ignore partial chunks
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + '\n\n*(Generación detenida)*' }
              : msg
          )
        );
      } else {
        const errorDetail = err?.message || 'Error desconocido al conectar con el asistente.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `❌ **Error de conexión con el AI Race Engineer**:\n${errorDetail}\n\n*Verifica tu API Key en la configuración (⚙️).*`,
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    if (isGenerating) handleStopGeneration();
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          '🔄 **Conversación reiniciada.**\n\nListo para un nuevo análisis. ¿Qué te gustaría consultar sobre las vueltas seleccionadas?',
        timestamp: new Date(),
      },
    ]);
  };

  const quickPrompts = [
    {
      id: 'delta-loss',
      icon: <Zap size={13} style={{ color: '#ffd200' }} />,
      label: '¿Dónde se ganó/perdió tiempo?',
      prompt: '¿Dónde se ganó o perdió la mayor cantidad de tiempo entre ambas vueltas? Dame un desglose técnico por sectores y curvas clave.',
    },
    {
      id: 'braking-traction',
      icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
      label: 'Frenada y tracción',
      prompt: 'Analiza y compara los puntos de frenada, presión máxima y la aceleración en la salida de las curvas entre ambas vueltas.',
    },
    {
      id: 'ers-drs',
      icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
      label: 'Despliegue ERS / DRS',
      prompt: 'Compara la estrategia de despliegue del motor eléctrico (ERS) y la utilización del DRS entre ambas vueltas.',
    },
    {
      id: 'zoomed-analysis',
      icon: <ZoomIn size={13} style={{ color: '#38ef7d' }} />,
      label: 'Tramo en zoom',
      prompt: 'Analiza en profundidad el tramo actualmente ampliado en el zoom de los gráficos y explica detalladamente la diferencia de pilotaje.',
      requiresZoom: true,
    },
  ];

  // Helper to format simple markdown text into react elements
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="chat-markdown">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} style={{ height: '0.4rem' }} />;
          }

          // Headers
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

          // Bullet points
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
    <div className="glass-panel ai-embedded-card" style={{ padding: '0.85rem' }}>
      {/* Header */}
      <div className="ai-drawer-header" style={{ padding: '0 0 0.65rem 0' }}>
        <div className="ai-drawer-title-group">
          <div className="ai-drawer-avatar" style={{ width: '32px', height: '32px' }}>
            <Bot size={18} style={{ color: '#e10600' }} />
          </div>
          <div>
            <h3 className="ai-drawer-title" style={{ fontSize: '0.95rem' }}>AI Race Engineer</h3>
            <div className="ai-drawer-meta">
              <span className="ai-badge-provider" style={{ fontSize: '0.68rem' }}>
                {config.provider.toUpperCase()} ({config.model})
              </span>
            </div>
          </div>
        </div>

        <div className="ai-drawer-actions">
          <button
            className="btn-icon"
            onClick={() => setShowSettings(!showSettings)}
            title="Configuración de IA"
            aria-label="Configuración"
          >
            <Settings size={16} />
          </button>
          <button
            className="btn-icon"
            onClick={handleClearChat}
            title="Limpiar conversación"
            aria-label="Limpiar chat"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Settings Overlay Card */}
      {showSettings && (
        <div className="ai-settings-card glass-panel" style={{ top: '50px' }}>
          <div className="ai-settings-header">
            <h4>Configuración del Asistente</h4>
            <button className="btn-icon" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="ai-settings-body">
            <label className="readout-label">Proveedor de IA</label>
            <select
              className="ui-select"
              value={config.provider}
              onChange={(e) => {
                const prov = e.target.value as AIConfig['provider'];
                saveConfig({
                  ...config,
                  provider: prov,
                  model: prov === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini',
                });
              }}
            >
              <option value="gemini">Google Gemini (Recomendado)</option>
              <option value="openai">OpenAI (GPT-4o-mini / GPT-4o)</option>
              <option value="custom">Endpoint Compatible OpenAI (Local / Groq / Ollama)</option>
            </select>

            <label className="readout-label" style={{ marginTop: '0.75rem' }}>
              API Key
              {config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey && (
                <span className="ai-env-badge">Detectada en servidor (.env)</span>
              )}
              {config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey && (
                <span className="ai-env-badge">Detectada en servidor (.env)</span>
              )}
            </label>
            <div className="ai-key-input-wrapper">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="ui-input"
                placeholder={
                  config.provider === 'gemini'
                    ? 'AIzaSy... (o déjalo vacío para usar .env)'
                    : 'sk-... (o déjalo vacío para usar .env)'
                }
                value={config.apiKey}
                onChange={(e) => saveConfig({ ...config, apiKey: e.target.value })}
              />
              <button
                type="button"
                className="ai-key-toggle-btn"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <small className="ai-settings-hint">
              Guardada localmente en tu navegador. Nunca se envía a terceros.
            </small>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', marginBottom: '0.35rem' }}>
              <label className="readout-label" style={{ margin: 0 }}>Modelo</label>
              <button
                type="button"
                className="ai-refresh-models-btn"
                onClick={() => fetchAvailableModels()}
                disabled={isLoadingModels}
                title="Consultar modelos disponibles en la API"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                }}
              >
                <RefreshCw size={12} className={isLoadingModels ? 'spin-icon' : ''} />
                {isLoadingModels ? 'Consultando...' : 'Actualizar modelos'}
              </button>
            </div>

            {availableModels.length > 0 && (
              <select
                className="ui-select"
                style={{ marginBottom: '0.5rem' }}
                value={availableModels.some((m) => m.id === config.model) ? config.model : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    saveConfig({ ...config, model: e.target.value });
                  }
                }}
              >
                <option value="" disabled>Selecciona un modelo detectado...</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.id} {m.id !== m.display_name ? `(${m.id})` : ''}
                  </option>
                ))}
                <option value="custom">✏️ Otro / Personalizado...</option>
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
              onChange={(e) => saveConfig({ ...config, model: e.target.value })}
              placeholder={config.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'}
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

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="nav-tab active" onClick={() => setShowSettings(false)}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lap Comparison Telemetry Status Bar */}
      <div className="ai-telemetry-statusbar" style={{ borderRadius: '6px', margin: '0.4rem 0' }}>
        {hasLapsSelected && telemetryContext ? (
          <div className="ai-status-active">
            <CheckCircle2 size={13} style={{ color: '#38ef7d', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem' }}>
              Δ{' '}
              <span className="mono" style={{ fontWeight: 700, color: telemetryContext.time_delta_seconds < 0 ? '#ff4757' : '#00d2d3' }}>
                {telemetryContext.time_delta_seconds > 0 ? '+' : ''}
                {telemetryContext.time_delta_seconds.toFixed(3)}s
              </span>
              {' '}• {telemetryContext.faster_lap}
            </span>
            {isZoomActive && telemetryContext.zoomed_range && (
              <span className="ai-zoom-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                🔍 Zoom: {telemetryContext.zoomed_range.start_distance_meters}m-{telemetryContext.zoomed_range.end_distance_meters}m
              </span>
            )}
          </div>
        ) : (
          <div className="ai-status-warning" style={{ fontSize: '0.75rem' }}>
            <AlertCircle size={13} style={{ color: '#ffd200', flexShrink: 0 }} />
            <span>Selecciona Vuelta A y Vuelta B para análisis en vivo.</span>
          </div>
        )}
      </div>

      {/* Messages Feed */}
      <div
        ref={messagesContainerRef}
        className="ai-messages-container"
        style={{ minHeight: '260px', maxHeight: '340px', padding: '0.6rem 0' }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-message-row ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            {msg.role === 'assistant' && (
              <div className="ai-msg-avatar" style={{ width: '24px', height: '24px' }}>
                <Bot size={14} />
              </div>
            )}
            <div className={`ai-message-bubble ${msg.role}`} style={{ fontSize: '0.82rem', padding: '0.65rem 0.85rem' }}>
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
              <span className="ai-msg-time" style={{ fontSize: '0.62rem' }}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Prompt Chips */}
      <div className="ai-quick-prompts-bar" style={{ padding: '0.4rem 0', background: 'transparent' }}>
        <div className="ai-quick-prompts-scroll">
          {quickPrompts.map((qp) => {
            const disabled = !hasLapsSelected || (qp.requiresZoom && !isZoomActive);
            return (
              <button
                key={qp.id}
                className={`ai-chip-btn ${qp.requiresZoom && isZoomActive ? 'zoom-highlight' : ''}`}
                disabled={disabled || isGenerating}
                onClick={() => handleSendMessage(qp.prompt)}
                title={disabled ? 'Requiere dos vueltas seleccionadas' : qp.label}
                style={{ fontSize: '0.72rem', padding: '4px 9px' }}
              >
                {qp.icon}
                <span>{qp.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Input Area */}
      <div className="ai-drawer-footer" style={{ padding: '0.5rem 0 0 0', background: 'transparent', borderTop: '1px solid var(--border-color)' }}>
        {!isConfigured && (
          <div className="ai-unconfigured-alert" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
            <span>⚠️ Configura tu API Key.</span>
            <button onClick={() => setShowSettings(true)}>Configurar</button>
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
            style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem' }}
            placeholder={
              !hasLapsSelected
                ? 'Selecciona vueltas para consultar...'
                : 'Pregunta al Race Engineer...'
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isGenerating || !hasLapsSelected}
          />

          {isGenerating ? (
            <button
              type="button"
              className="ai-btn-stop"
              style={{ width: '32px', height: '32px' }}
              onClick={handleStopGeneration}
              title="Detener generación"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className="ai-btn-send"
              style={{ width: '32px', height: '32px' }}
              disabled={!inputMessage.trim() || !hasLapsSelected}
              title="Enviar mensaje"
            >
              <Send size={14} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

function buildSystemPromptText(ctx: TelemetryContextPayload | null): string {
  let prompt =
    'Eres el Ingeniero de Pista de F1 (Race Engineer) personal y analista de telemetría exclusivo del PILOTO DE LA VUELTA A (el primer piloto seleccionado).\n' +
    'Tu función es hablarle directamente a tu piloto (Vuelta A) por la radio del equipo para analizar su rendimiento, diagnosticar sus pérdidas/ganancias de tiempo y darle recomendaciones de pilotaje claras y técnicas para batir a la Vuelta B (vuelta de comparación/rival).\n\n' +
    'REGLAS FUNDAMENTALES DE ENFOQUE Y ASIGNACIÓN:\n' +
    '1. DIRÍGETE SIEMPRE EN SEGUNDA PERSONA A TU PILOTO (VUELTA A): Usa "tú", "tu tiempo", "estás frenando", "tu tracción", refiriéndote siempre al piloto de la Vuelta A.\n' +
    '2. LA VUELTA B ES SIEMPRE LA REFERENCIA / RIVAL: Refiérete a la Vuelta B como "el rival", "Vuelta B" o por el nombre del piloto B. NUNCA le des consejos de mejora al piloto de la Vuelta B ni asumas el rol de su ingeniero.\n' +
    '3. SI TU PILOTO (VUELTA A) ES MÁS LENTO: Explícale exactamente dónde pierde tiempo (ej. "Frenas 15m antes que Vuelta B en la curva 1", "Pierdes 0.15s en la tracción de la horquilla") y dale la instrucción precisa para recortar esa diferencia.\n' +
    '4. SI TU PILOTO (VUELTA A) ES MÁS RÁPIDO: Felicítalo por la vuelta, destaca dónde sacó la ventaja a la Vuelta B, y si existe alguna curva puntual donde Vuelta B fue mejor, indícaselo como oportunidad para ganar aún más tiempo.\n' +
    '5. COMUNICACIÓN Y FORMATO: Comunícate en español con tono profesional, directo y conciso de radio de F1. Usa Markdown estructurado (negritas, listas cortas).\n' +
    '6. NO INVENTES NI MENCIONES SETUPS DEL COCHE: Los setups de otros pilotos no están disponibles. Concéntrate 100% en la técnica de conducción, puntos de frenada, velocidad de ápice en curva, tracción y uso de ERS/DRS.\n\n';

  if (ctx) {
    prompt += `### DATOS DE TELEMETRÍA DE LA COMPARATIVA:\n`;
    prompt += `- Circuito: ${ctx.track_name} | Sesión: ${ctx.session_type}\n`;
    prompt += `- TU PILOTO (Vuelta A): ${ctx.lap_a_name} (${ctx.lap_a_time_formatted}) - Neumático: ${ctx.lap_a_compound}\n`;
    prompt += `- RIVAL / REFERENCIA (Vuelta B): ${ctx.lap_b_name} (${ctx.lap_b_time_formatted}) - Neumático: ${ctx.lap_b_compound}\n`;
    prompt += `- Delta Total: ${ctx.time_delta_seconds.toFixed(3)}s (Más rápida: ${ctx.faster_lap})\n`;
    prompt += `- Sectores:\n`;
    prompt += `  * Sector 1: Tu tiempo (${ctx.lap_a_s1_formatted}) vs Rival (${ctx.lap_b_s1_formatted})\n`;
    prompt += `  * Sector 2: Tu tiempo (${ctx.lap_a_s2_formatted}) vs Rival (${ctx.lap_b_s2_formatted})\n`;
    prompt += `  * Sector 3: Tu tiempo (${ctx.lap_a_s3_formatted}) vs Rival (${ctx.lap_b_s3_formatted})\n`;
    prompt += `- Velocidad Máxima: Tu velocidad = ${ctx.top_speed_a.toFixed(1)} km/h | Rival = ${ctx.top_speed_b.toFixed(1)} km/h\n`;
    prompt += `- Despliegue ERS acumulado: Tu uso = ${ctx.ers_a_used_percent.toFixed(1)}% | Rival = ${ctx.ers_b_used_percent.toFixed(1)}%\n`;

    if (ctx.braking_summary) prompt += `- Análisis de Frenada: ${ctx.braking_summary}\n`;
    if (ctx.apex_speed_summary) prompt += `- Velocidad en Curvas / Ápice: ${ctx.apex_speed_summary}\n`;
    if (ctx.throttle_summary) prompt += `- Tracción y Aceleración: ${ctx.throttle_summary}\n`;
    if (ctx.ers_drs_summary) prompt += `- ERS y DRS: ${ctx.ers_drs_summary}\n`;

    if (ctx.zoomed_range) {
      prompt += `\n### TRAMO EN ZOOM SELECCIONADO POR EL PILOTO (${ctx.zoomed_range.start_distance_meters}m - ${ctx.zoomed_range.end_distance_meters}m):\n`;
      if (ctx.zoomed_range.description) prompt += `- Descripción: ${ctx.zoomed_range.description}\n`;
      prompt += `- Delta en este tramo: ${ctx.zoomed_range.delta_in_segment.toFixed(3)}s\n`;
      prompt += `- Diferencia de velocidad mínima en curva: ${ctx.zoomed_range.speed_diff_at_apex.toFixed(1)} km/h\n`;
    }
  } else {
    prompt += 'Actualmente no hay dos vueltas seleccionadas en el comparador. Si el usuario pregunta, indícale amablemente que seleccione una Vuelta A y una Vuelta B para poder analizar su telemetría.\n';
  }

  return prompt;
}
