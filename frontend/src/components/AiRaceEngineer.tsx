import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  Square,
  Settings,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  useRaceEngineer,
  providerHasKey,
  AI_PROVIDER_OPTIONS,
  STORAGE_KEY_AI_EXPANDED,
} from '../context/RaceEngineerContext';
import { storage } from '../utils/storage';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { LIVE_STATUS, getTrackInfo, TRACK_NAMES } from '../constants/f1';
import { TrackFlag } from './TrackFlag';
import { PromptChipBar } from './ai_engineer/PromptChipBar';
import { ChatMessageList } from './ai_engineer/ChatMessageList';
import { ChatSettingsDrawer } from './ai_engineer/ChatSettingsDrawer';

export interface AiRaceEngineerProps {
  // Optional overrides for standalone or test usage
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
}

/** Tallest the message box grows, in pixels, before it scrolls. */
const INPUT_MAX_HEIGHT_PX = 140;

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
  isOpenOverride,
  onCloseOverride,
}) => {
  const { t } = useI18n();
  const {
    isOpen: contextIsOpen,
    closeChat,
    toggleChat,
    contextMode,
    comparatorTarget,
    sessionDebriefTarget,
    messages,
    sendMessage,
    retryLastMessage,
    clearMessages,
    isGenerating,
    stopGenerating,
    config,
    saveConfig,
    keyStatus,
    saveApiKey,
    availableModels,
    isLoadingModels,
    modelsError,
    fetchAvailableModels,
  } = useRaceEngineer();

  const isOpen = isOpenOverride !== undefined ? isOpenOverride : contextIsOpen;
  const handleClose = onCloseOverride || closeChat;

  const [showSettings, setShowSettings] = useState(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(() => storage.get<boolean>(STORAGE_KEY_AI_EXPANDED, false));
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    storage.set(STORAGE_KEY_AI_EXPANDED, isExpanded);
  }, [isExpanded]);

  // Grow the message box with its text, up to a few lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
  }, [inputMessage, isOpen]);

  const effectiveMode = contextMode;
  const hasLapsSelected = comparatorTarget !== null;
  const isZoomActive = Boolean(comparatorTarget?.zoom);

  // Only the track and whether telemetry is coming in, so the 10 Hz feed doesn't re-render the chat
  const liveTrackId = useSessionStatusStore((s) => s.session?.TrackId);
  const isLiveStandby = useLiveStatus() !== LIVE_STATUS.LIVE;
  const liveTrackName =
    liveTrackId === undefined ? null : getTrackInfo(liveTrackId)?.name || TRACK_NAMES[liveTrackId] || null;

  // Focus the message box when opened, and again once a reply has finished
  useEffect(() => {
    if (isOpen && !showSettings && !isGenerating) {
      inputRef.current?.focus();
    }
  }, [isOpen, showSettings, isGenerating]);

  // Fetch models when opening settings, switching provider or server, or once a key is saved
  const hasKey = providerHasKey(keyStatus, config.provider);
  const serverAddress = config.provider === 'custom' ? config.baseUrl : '';
  const fetchModelsRef = useRef(fetchAvailableModels);
  fetchModelsRef.current = fetchAvailableModels;
  useEffect(() => {
    if (showSettings && hasKey) {
      fetchModelsRef.current();
    }
  }, [showSettings, config.provider, serverAddress, hasKey]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMessage.trim();
    if (!text || isGenerating) return;
    setInputMessage('');
    sendMessage(text);
  };

  // Enter sends, Shift+Enter starts a new line.
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const providerName = t(
    AI_PROVIDER_OPTIONS.find((option) => option.provider === config.provider)?.nameKey ?? config.provider
  );

  const handlePromptChipClick = (prompt: string) => {
    if (isGenerating) return;
    sendMessage(prompt);
  };

  // Context Mode Badge label & color
  const contextBadgeInfo = useMemo(() => {
    if (effectiveMode === 'comparator') {
      const track = comparatorTarget?.trackName || null;
      return {
        label: t('ai_engineer.badges.comparator'),
        sub: track || t('ai_engineer.selectLaps'),
        track,
        color: '#00f2fe',
      };
    }
    if (effectiveMode === 'session_debrief' && sessionDebriefTarget) {
      return {
        label: t('ai_engineer.badges.debrief'),
        sub: sessionDebriefTarget.trackName || t('ai_engineer.modeDebrief'),
        track: sessionDebriefTarget.trackName,
        color: '#ffd700',
      };
    }
    if (effectiveMode === 'live') {
      const track = isLiveStandby ? null : liveTrackName;
      return {
        label: t('ai_engineer.badges.liveWall'),
        sub: track || t('ai_engineer.liveSessionStandby'),
        track,
        color: '#38ef7d',
      };
    }
    return {
      label: t('ai_engineer.badges.standby'),
      sub: t('ai_engineer.telemetryReady'),
      track: null,
      color: 'var(--text-secondary)',
    };
  }, [effectiveMode, comparatorTarget, sessionDebriefTarget, isLiveStandby, liveTrackName, t]);

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
    <div
      className={`ai-floating-widget${isExpanded ? ' is-expanded' : ''}`}
      role="region"
      aria-label="AI Race Engineer Chat"
    >
      {/* Widget Header */}
      <div className="ai-widget-header">
        <div className="ai-widget-header-left">
          <div className="ai-widget-avatar">
            <Bot size={18} color="#00f2fe" />
          </div>
          <div className="ai-widget-heading">
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
            <div className="ai-widget-sub">
              {contextBadgeInfo.track && <TrackFlag track={contextBadgeInfo.track} width={13} height={9} />}
              <span className="ai-widget-sub-context">{contextBadgeInfo.sub}</span>
              <span className="ai-widget-sub-sep">•</span>
              <button
                type="button"
                className="ai-widget-model-chip mono"
                onClick={() => setShowSettings(true)}
                title={config.model ? `${providerName} · ${config.model}` : providerName}
              >
                {config.model || providerName}
              </button>
            </div>
          </div>
        </div>

        <div className="ai-widget-header-actions">
          <button
            className={`ai-btn-icon${showSettings ? ' is-active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title={t('ai_engineer.settings')}
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
          <button
            className="ai-btn-icon"
            onClick={clearMessages}
            title={t('ai_engineer.clearChat')}
            aria-label="Clear chat"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="ai-btn-icon"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? t('ai_engineer.collapse') : t('ai_engineer.expand')}
            aria-label={isExpanded ? t('ai_engineer.collapse') : t('ai_engineer.expand')}
          >
            {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            className="ai-btn-icon ai-btn-close"
            onClick={handleClose}
            title={t('ai_engineer.close')}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Embedded Settings Drawer within widget */}
      <ChatSettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        saveConfig={saveConfig}
        keyStatus={keyStatus}
        saveApiKey={saveApiKey}
        availableModels={availableModels}
        isLoadingModels={isLoadingModels}
        modelsError={modelsError}
        fetchAvailableModels={fetchAvailableModels}
      />

      {/* Quick Prompt Chips */}
      <PromptChipBar
        effectiveMode={effectiveMode}
        hasLapsSelected={hasLapsSelected}
        isZoomActive={isZoomActive}
        hasDebriefSession={sessionDebriefTarget !== null}
        isLiveStandby={isLiveStandby}
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
          <textarea
            ref={inputRef}
            rows={1}
            className="ai-chat-input"
            placeholder={getChatPlaceholder(effectiveMode, t)}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isGenerating}
            title={t('ai_engineer.inputHint')}
          />

          {isGenerating ? (
            <button
              type="button"
              className="ai-btn-submit ai-btn-stop"
              onClick={stopGenerating}
              title={t('ai_engineer.stop')}
              aria-label={t('ai_engineer.stop')}
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              type="submit"
              className="ai-btn-submit"
              disabled={!inputMessage.trim()}
              title={t('ai_engineer.send')}
              aria-label={t('ai_engineer.send')}
            >
              <Send size={14} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
