import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Minus,
  Sparkles,
  Flag,
  CloudRain,
  Key,
  AlertTriangle,
  Radio,
  WifiOff,
  ExternalLink,
} from 'lucide-react';
import { useRaceEngineer, type AIConfig, type ChatMessage } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { TrackFlag } from './TrackFlag';
import { AI_PROVIDER_URLS } from '../constants/f1';


export interface AiRaceEngineerProps {
  // Optional overrides for standalone or test usage
  telemetryContext?: TelemetryContextPayload | null;
  hasLapsSelected?: boolean;
  isZoomActive?: boolean;
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
}

export const AiRaceEngineer: React.FC<AiRaceEngineerProps> = ({
  telemetryContext: propTelemetryContext,
  hasLapsSelected: propHasLapsSelected,
  isZoomActive: propIsZoomActive,
  isOpenOverride,
  onCloseOverride,
}) => {
  const { t } = useI18n();
  const {
    isOpen: contextIsOpen,
    closeChat,
    toggleChat,
    contextMode,
    comparatorContext,
    sessionDebriefContext,
    liveContext,
    messages,
    sendMessage,
    retryLastMessage,
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
  } = useRaceEngineer();

  const isOpen = isOpenOverride !== undefined ? isOpenOverride : contextIsOpen;
  const handleClose = onCloseOverride || closeChat;

  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync prop telemetry context if passed
  const activeComparatorContext = propTelemetryContext || comparatorContext;
  const hasLapsSelected = propHasLapsSelected ?? Boolean(activeComparatorContext?.lap_a_name && activeComparatorContext?.lap_b_name);
  const isZoomActive = propIsZoomActive ?? Boolean(activeComparatorContext?.zoomed_range);

  // Scroll messages to bottom smoothly
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !showSettings) {
      inputRef.current?.focus();
    }
  }, [isOpen, showSettings]);

  // Fetch models when opening settings
  useEffect(() => {
    if (showSettings && config.apiKey) {
      fetchAvailableModels();
    }
  }, [showSettings, config.provider, config.apiKey, fetchAvailableModels]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isGenerating) return;
    setInputMessage('');
    sendMessage(text);
  };

  const handlePromptChipClick = (prompt: string) => {
    if (isGenerating) return;
    sendMessage(prompt);
  };

  // Render rich error card for failed AI transmissions
  const renderErrorCard = (m: ChatMessage) => {
    const code = m.errorCode || 'GENERIC_ERROR';
    const providerKey = (m.errorProvider || config.provider) as keyof typeof AI_PROVIDER_URLS;
    const providerInfo = AI_PROVIDER_URLS[providerKey] || AI_PROVIDER_URLS.gemini;

    let icon = <AlertTriangle size={15} color="#ff4b4b" />;
    let title = t('ai_engineer.errors.genericErrorTitle');
    let desc = m.errorRaw || t('ai_engineer.errors.genericErrorDesc');
    let isWarning = false;

    if (code === 'MISSING_API_KEY') {
      icon = <Key size={15} color="#ffd200" />;
      title = t('ai_engineer.errors.missingKeyTitle');
      desc = t('ai_engineer.errors.missingKeyDesc');
      isWarning = true;
    } else if (code === 'MODEL_OVERLOADED') {
      icon = <Radio size={15} color="#ff8000" className="animate-pulse" />;
      title = t('ai_engineer.errors.modelOverloadedTitle');
      desc = t('ai_engineer.errors.modelOverloadedDesc');
      isWarning = true;
    } else if (code === 'QUOTA_EXCEEDED') {
      icon = <AlertTriangle size={15} color="#ff4b4b" />;
      title = t('ai_engineer.errors.quotaExceededTitle');
      desc = t('ai_engineer.errors.quotaExceededDesc');
    } else if (code === 'INVALID_API_KEY') {
      icon = <Key size={15} color="#ff4b4b" />;
      title = t('ai_engineer.errors.invalidKeyTitle');
      desc = t('ai_engineer.errors.invalidKeyDesc');
    } else if (code === 'MODEL_NOT_FOUND') {
      icon = <AlertTriangle size={15} color="#ffd200" />;
      title = t('ai_engineer.errors.modelNotFoundTitle');
      desc = t('ai_engineer.errors.modelNotFoundDesc');
      isWarning = true;
    } else if (code === 'NETWORK_ERROR') {
      icon = <WifiOff size={15} color="#ff4b4b" />;
      title = t('ai_engineer.errors.networkErrorTitle');
      desc = t('ai_engineer.errors.networkErrorDesc');
    }

    return (
      <div className={`ai-error-card ${isWarning ? 'ai-error-card-warning' : ''}`} data-testid="ai-error-card">
        <div className="ai-error-card-header">
          <div className="ai-error-card-icon-wrapper">{icon}</div>
          <div className="ai-error-card-title">{title}</div>
        </div>
        <div className="ai-error-card-desc">{desc}</div>
        <div className="ai-error-card-actions">
          {m.canRetry && (
            <button
              type="button"
              className="ai-error-action-btn ai-error-action-primary"
              onClick={() => retryLastMessage(m.id)}
              disabled={isGenerating}
            >
              <RefreshCw size={11} className={isGenerating ? 'animate-spin' : ''} />
              <span>{t('ai_engineer.retry')}</span>
            </button>
          )}
          {providerInfo && (code === 'MISSING_API_KEY' || code === 'INVALID_API_KEY' || code === 'QUOTA_EXCEEDED') && (
            <a
              href={providerInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ai-error-action-btn ai-error-action-primary"
            >
              <span>{t('ai_engineer.errors.getKeyButton', { provider: providerInfo.name })}</span>
              <ExternalLink size={11} />
            </a>
          )}
          <button
            type="button"
            className="ai-error-action-btn ai-error-action-secondary"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={11} />
            <span>{t('ai_engineer.openSettings')}</span>
          </button>
        </div>
      </div>
    );
  };

  // Adaptive quick prompt chips
  const adaptivePromptChips = useMemo(() => {
    if (contextMode === 'comparator' || (hasLapsSelected && activeComparatorContext)) {
      const chips = [
        {
          id: 'delta-loss',
          icon: <Zap size={13} style={{ color: '#ffd200' }} />,
          label: t('ai_engineer.chips.deltaLossLabel'),
          prompt: t('ai_engineer.chips.deltaLossPrompt'),
        },
        {
          id: 'braking-traction',
          icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
          label: t('ai_engineer.chips.brakingTractionLabel'),
          prompt: t('ai_engineer.chips.brakingTractionPrompt'),
        },
        {
          id: 'ers-drs',
          icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.ersDrsLabel'),
          prompt: t('ai_engineer.chips.ersDrsPrompt'),
        },
      ];
      if (isZoomActive) {
        chips.unshift({
          id: 'zoomed-analysis',
          icon: <ZoomIn size={13} style={{ color: '#38ef7d' }} />,
          label: t('ai_engineer.chips.zoomedAnalysisLabel'),
          prompt: t('ai_engineer.chips.zoomedAnalysisPrompt'),
        });
      }
      return chips;
    }

    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return [
        {
          id: 'debrief-overview',
          icon: <Sparkles size={13} style={{ color: '#ffd700' }} />,
          label: t('ai_engineer.chips.debriefOverviewLabel'),
          prompt: t('ai_engineer.chips.debriefOverviewPrompt'),
        },
        {
          id: 'debrief-tyres',
          icon: <Gauge size={13} style={{ color: '#ff8000' }} />,
          label: t('ai_engineer.chips.debriefTyresLabel'),
          prompt: t('ai_engineer.chips.debriefTyresPrompt'),
        },
        {
          id: 'debrief-sectors',
          icon: <Zap size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.debriefSectorsLabel'),
          prompt: t('ai_engineer.chips.debriefSectorsPrompt'),
        },
      ];
    }

    if (contextMode === 'live' && liveContext) {
      return [
        {
          id: 'live-weather',
          icon: <CloudRain size={13} style={{ color: '#00f2fe' }} />,
          label: t('ai_engineer.chips.liveWeatherLabel'),
          prompt: t('ai_engineer.chips.liveWeatherPrompt'),
        },
        {
          id: 'live-strategy',
          icon: <Flag size={13} style={{ color: '#ffd200' }} />,
          label: t('ai_engineer.chips.liveStrategyLabel'),
          prompt: t('ai_engineer.chips.liveStrategyPrompt'),
        },
        {
          id: 'live-pace',
          icon: <Zap size={13} style={{ color: '#38ef7d' }} />,
          label: t('ai_engineer.chips.livePaceLabel'),
          prompt: t('ai_engineer.chips.livePacePrompt'),
        },
      ];
    }

    // Default general chips
    return [
      {
        id: 'gen-trail-braking',
        icon: <Gauge size={13} style={{ color: '#ff4b4b' }} />,
        label: t('ai_engineer.chips.genTrailBrakingLabel'),
        prompt: t('ai_engineer.chips.genTrailBrakingPrompt'),
      },
      {
        id: 'gen-tyre-management',
        icon: <Zap size={13} style={{ color: '#ffd200' }} />,
        label: t('ai_engineer.chips.genTyreManagementLabel'),
        prompt: t('ai_engineer.chips.genTyreManagementPrompt'),
      },
      {
        id: 'gen-ers',
        icon: <Cpu size={13} style={{ color: '#00f2fe' }} />,
        label: t('ai_engineer.chips.genErsLabel'),
        prompt: t('ai_engineer.chips.genErsPrompt'),
      },
    ];
  }, [contextMode, activeComparatorContext, hasLapsSelected, isZoomActive, sessionDebriefContext, liveContext, t]);

  // Context Mode Badge label & color
  const contextBadgeInfo = useMemo(() => {
    if (contextMode === 'comparator' || (hasLapsSelected && activeComparatorContext)) {
      return {
        label: 'Comparator',
        sub: activeComparatorContext?.track_name || 'Laps Selected',
        track: activeComparatorContext?.track_name,
        color: '#00f2fe',
      };
    }
    if (contextMode === 'session_debrief' && sessionDebriefContext) {
      return {
        label: 'Debrief',
        sub: sessionDebriefContext.trackName,
        track: sessionDebriefContext.trackName,
        color: '#ffd700',
      };
    }
    if (contextMode === 'live' && liveContext) {
      return {
        label: 'Live Wall',
        sub: liveContext.trackName || 'Active Session',
        track: liveContext.trackName,
        color: '#38ef7d',
      };
    }
    return {
      label: 'Standby',
      sub: 'Telemetry Ready',
      track: null,
      color: 'var(--text-secondary)',
    };
  }, [contextMode, activeComparatorContext, hasLapsSelected, sessionDebriefContext, liveContext]);


  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="chat-markdown">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} style={{ height: '0.35rem' }} />;
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

          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="chat-bullet">
                <span className="chat-bullet-dot">•</span>
                <span>{parseInlineFormatting(line.substring(2))}</span>
              </div>
            );
          }

          if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s(.*)$/);
            if (match) {
              return (
                <div key={idx} className="chat-bullet">
                  <span className="chat-bullet-num mono">{match[1]}.</span>
                  <span>{parseInlineFormatting(match[2])}</span>
                </div>
              );
            }
          }

          return (
            <p key={idx} className="chat-p">
              {parseInlineFormatting(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const parseInlineFormatting = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let cur = text;
    let match: RegExpExecArray | null;

    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIdx = 0;

    while ((match = boldRegex.exec(cur)) !== null) {
      if (match.index > lastIdx) {
        parts.push(cur.substring(lastIdx, match.index));
      }
      parts.push(
        <strong key={`b-${match.index}`} style={{ color: '#fff', fontWeight: 600 }}>
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

  // If closed: render Floating Action Button (FAB)
  if (!isOpen) {
    return (
      <div className="ai-fab-container">
        <button
          className="ai-fab-button"
          onClick={toggleChat}
          title="Open AI Race Engineer"
          aria-label="Open AI Race Engineer"
        >
          <div className="ai-fab-icon-wrapper">
            <Bot size={22} className="ai-fab-bot-icon" />
            <span className="ai-fab-pulse-ring" />
          </div>
          <span className="ai-fab-label">Race Engineer</span>
        </button>
      </div>
    );
  }

  // When open: render Floating Chat Widget (No modal-overlay backdrop)
  return (
    <div className="ai-floating-widget glass-panel" role="region" aria-label="AI Race Engineer Chat">
      {/* Widget Header */}
      <div className="ai-widget-header">
        <div className="ai-widget-header-left">
          <div className="ai-widget-avatar">
            <Bot size={18} color="#00f2fe" />
          </div>
          <div>
            <div className="ai-widget-title-row">
              <span className="ai-widget-title">AI Race Engineer</span>
              <span
                className="ai-context-badge mono"
                style={{
                  color: contextBadgeInfo.color,
                  borderColor: `${contextBadgeInfo.color}40`,
                  backgroundColor: `${contextBadgeInfo.color}15`,
                }}
              >
                {contextBadgeInfo.label}
              </span>
            </div>
            <div className="ai-widget-sub mono" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              {contextBadgeInfo.track && <TrackFlag track={contextBadgeInfo.track} width={13} height={9} />}
              <span>{contextBadgeInfo.sub} • {config.model.replace('gemini-', '').replace('-latest', '')}</span>
            </div>

          </div>
        </div>

        <div className="ai-widget-header-actions">
          <button
            className="ai-btn-icon"
            onClick={() => setShowSettings(!showSettings)}
            title="Configure AI API & Model"
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
          <button
            className="ai-btn-icon"
            onClick={clearMessages}
            title="Clear conversation"
            aria-label="Clear chat"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="ai-btn-icon"
            onClick={handleClose}
            title="Minimize Race Engineer"
            aria-label="Minimize"
          >
            <Minus size={15} />
          </button>
          <button
            className="ai-btn-icon ai-btn-close"
            onClick={handleClose}
            title="Close"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Embedded Settings Drawer within widget */}
      {showSettings && (
        <div className="ai-widget-settings-panel glass-panel" data-testid="ai-settings-panel">
          <div className="ai-settings-header">
            <h4>{t('ai_engineer.settings')}</h4>
            <button className="ai-btn-icon" onClick={() => setShowSettings(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="ai-settings-body">
            <label className="readout-label">{t('ai_engineer.provider')}</label>
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
              <option value="gemini">{t('ai_engineer.geminiOption')}</option>
              <option value="openai">{t('ai_engineer.openaiOption')}</option>
              <option value="custom">{t('ai_engineer.customOption')}</option>
            </select>

            <label className="readout-label" style={{ marginTop: '0.65rem' }}>
              {t('ai_engineer.apiKey')}
              {config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey && (
                <span className="ai-env-badge">{t('ai_engineer.serverEnvActive')}</span>
              )}
            </label>
            <div className="ai-input-with-icon">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="ui-input"
                placeholder={
                  (config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey) ||
                  (config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey)
                    ? t('ai_engineer.usingServerKey')
                    : t('ai_engineer.enterApiKey')
                }
                value={config.apiKey}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedKeys = { ...(config.providerKeys || {}), [config.provider]: val };
                  saveConfig({ ...config, apiKey: val, providerKeys: updatedKeys });
                }}
              />
              <button
                type="button"
                className="ai-input-action-btn"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            {/* Direct Link to Get API Key for selected provider */}
            {AI_PROVIDER_URLS[config.provider] && (
              <div className="ai-settings-key-link">
                <a
                  href={AI_PROVIDER_URLS[config.provider].url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    {t(
                      AI_PROVIDER_URLS[config.provider].freeTier
                        ? 'ai_engineer.getFreeApiKey'
                        : 'ai_engineer.getApiKey',
                      { provider: AI_PROVIDER_URLS[config.provider].name }
                    )}
                  </span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem' }}>
              <label className="readout-label" style={{ margin: 0 }}>{t('ai_engineer.model')}</label>
              <button
                type="button"
                className="ai-link-btn"
                onClick={() => fetchAvailableModels()}
                disabled={isLoadingModels}
                title="Query available models from API"
              >
                <RefreshCw size={11} className={isLoadingModels ? 'animate-spin' : ''} /> {t('ai_engineer.refreshModels')}
              </button>
            </div>

            {availableModels.length > 0 ? (
              <select
                className="ui-select"
                value={config.model}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedModels = { ...(config.providerModels || {}), [config.provider]: val };
                  saveConfig({ ...config, model: val, providerModels: updatedModels });
                }}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="ui-input"
                value={config.model}
                placeholder="e.g. gemini-flash-lite-latest, gpt-4o-mini"
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedModels = { ...(config.providerModels || {}), [config.provider]: val };
                  saveConfig({ ...config, model: val, providerModels: updatedModels });
                }}
              />
            )}

            {modelsError && <div className="ai-error-text">{modelsError}</div>}

            {config.provider === 'custom' && (
              <>
                <label className="readout-label" style={{ marginTop: '0.65rem' }}>Base URL</label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="https://api.openai.com/v1"
                  value={config.baseUrl}
                  onChange={(e) => saveConfig({ ...config, baseUrl: e.target.value })}
                />
              </>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }} onClick={() => setShowSettings(false)}>
                {t('ai_engineer.done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompt Chips */}
      <div className="ai-widget-chips-row">
        {adaptivePromptChips.map((chip) => (
          <button
            key={chip.id}
            className="ai-prompt-chip"
            onClick={() => handlePromptChipClick(chip.prompt)}
            disabled={isGenerating}
          >
            {chip.icon}
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="ai-widget-messages" ref={messagesContainerRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`ai-message-row ${m.role === 'user' ? 'ai-user-row' : 'ai-assistant-row'}`}
          >
            <div className={`ai-message-bubble ${m.role === 'user' ? 'ai-user-bubble' : 'ai-assistant-bubble'}`}>
              <div className="ai-message-meta">
                {m.role === 'assistant' ? <Bot size={12} color="#00f2fe" /> : null}
                <span>{m.role === 'assistant' ? t('ai_engineer.roleEngineer') : t('ai_engineer.roleYou')}</span>
              </div>
              <div className="ai-message-body">
                {m.errorCode ? (
                  renderErrorCard(m)
                ) : m.content ? (
                  renderFormattedMarkdown(m.content)
                ) : isGenerating && m.role === 'assistant' ? (
                  <div className="ai-typing-indicator">
                    <span className="ai-dot" />
                    <span className="ai-dot" />
                    <span className="ai-dot" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div className="ai-widget-input-bar">
        <form onSubmit={handleSubmit} className="ai-widget-input-form">
          <input
            ref={inputRef}
            type="text"
            className="ai-chat-input"
            placeholder={
              contextMode === 'comparator' || (hasLapsSelected && activeComparatorContext)
                ? t('ai_engineer.placeholderComparator')
                : contextMode === 'session_debrief'
                ? t('ai_engineer.placeholderDebrief')
                : contextMode === 'live'
                ? t('ai_engineer.placeholderLive')
                : t('ai_engineer.placeholderGeneral')
            }
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isGenerating}
          />

          {isGenerating ? (
            <button
              type="button"
              className="ai-btn-submit ai-btn-stop"
              onClick={stopGenerating}
              title="Stop response"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className="ai-btn-submit"
              disabled={!inputMessage.trim()}
              title={t('ai_engineer.send')}
            >
              <Send size={14} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
