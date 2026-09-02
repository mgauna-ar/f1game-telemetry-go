import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  Square,
  Settings,
  RotateCcw,
  X,
  Minus,
} from 'lucide-react';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import type { TelemetryContextPayload } from '../utils/aiTelemetrySummary';
import { TrackFlag } from './TrackFlag';
import { PromptChipBar } from './ai_engineer/PromptChipBar';
import { ChatMessageList } from './ai_engineer/ChatMessageList';
import { ChatSettingsDrawer } from './ai_engineer/ChatSettingsDrawer';

export interface AiRaceEngineerProps {
  // Optional overrides for standalone or test usage
  telemetryContext?: TelemetryContextPayload | null;
  hasLapsSelected?: boolean;
  isZoomActive?: boolean;
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
}

const getChatPlaceholder = (effectiveMode: string, t: (key: string) => string): string => {

  switch (effectiveMode) {
    case 'comparator':
      return t('ai_engineer.placeholderComparator');
    case 'session_debrief':
      return t('ai_engineer.placeholderDebrief');
    case 'live':
      return t('ai_engineer.placeholderLive');
    default:
      return t('ai_engineer.placeholderGeneral');
  }
};

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
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Effective context mode: if propTelemetryContext is passed directly as prop, it's comparator mode. Otherwise, it follows contextMode.
  const effectiveMode = propTelemetryContext ? 'comparator' : contextMode;

  // Sync prop telemetry context if passed
  const activeComparatorContext = propTelemetryContext || (effectiveMode === 'comparator' ? comparatorContext : null);
  const hasLapsSelected = propHasLapsSelected ?? Boolean(activeComparatorContext?.lap_a_name && activeComparatorContext?.lap_b_name);
  const isZoomActive = propIsZoomActive ?? Boolean(activeComparatorContext?.zoomed_range);

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

  // Context Mode Badge label & color
  const contextBadgeInfo = useMemo(() => {
    if (effectiveMode === 'comparator') {
      const hasLaps = hasLapsSelected && activeComparatorContext;
      return {
        label: t('ai_engineer.badges.comparator'),
        sub: hasLaps ? (activeComparatorContext?.track_name || t('ai_engineer.selectLaps')) : t('ai_engineer.selectLaps'),
        track: hasLaps ? activeComparatorContext?.track_name : null,
        color: '#00f2fe',
      };
    }
    if (effectiveMode === 'session_debrief' && sessionDebriefContext) {
      return {
        label: t('ai_engineer.badges.debrief'),
        sub: sessionDebriefContext.trackName || t('ai_engineer.modeDebrief'),
        track: sessionDebriefContext.trackName,
        color: '#ffd700',
      };
    }
    if (effectiveMode === 'live') {
      const hasTrack = liveContext?.trackName && liveContext.trackName !== 'F1 Pit Wall';
      return {
        label: t('ai_engineer.badges.liveWall'),
        sub: hasTrack ? liveContext.trackName : t('ai_engineer.liveSessionStandby'),
        track: hasTrack ? liveContext.trackName : null,
        color: '#38ef7d',
      };
    }
    return {
      label: t('ai_engineer.badges.standby'),
      sub: t('ai_engineer.telemetryReady'),
      track: null,
      color: 'var(--text-secondary)',
    };
  }, [effectiveMode, activeComparatorContext, hasLapsSelected, sessionDebriefContext, liveContext, t]);

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
      <ChatSettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        saveConfig={saveConfig}
        serverConfigStatus={serverConfigStatus}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        modelsError={modelsError}
        fetchAvailableModels={fetchAvailableModels}
      />

      {/* Quick Prompt Chips */}
      <PromptChipBar
        effectiveMode={effectiveMode}
        activeComparatorContext={activeComparatorContext}
        hasLapsSelected={hasLapsSelected}
        isZoomActive={isZoomActive}
        sessionDebriefContext={sessionDebriefContext}
        liveContext={liveContext}
        isGenerating={isGenerating}
        onSelectPrompt={handlePromptChipClick}
      />

      {/* Messages Scroll Area */}
      <ChatMessageList
        messages={messages}
        isGenerating={isGenerating}
        defaultProvider={config.provider}
        onRetry={retryLastMessage}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Chat Input Bar */}
      <div className="ai-widget-input-bar">
        <form onSubmit={handleSubmit} className="ai-widget-input-form">
          <input
            ref={inputRef}
            type="text"
            className="ai-chat-input"
            placeholder={getChatPlaceholder(effectiveMode, t)}
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
