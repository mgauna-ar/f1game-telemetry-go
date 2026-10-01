import React, { useState, useEffect, useId, useRef, useMemo } from 'react';
import { Bot, Send, Square, Settings, RotateCcw, X, Maximize2, Minimize2, PanelRight, PanelRightClose } from 'lucide-react';
import {
  useRaceEngineer,
  providerHasKey,
  AI_PROVIDER_OPTIONS,
} from '../context/RaceEngineerContext';
import { useDevicePreferencesStore } from '../store/useDevicePreferencesStore';
import { useI18n } from '../context/I18nContext';
import { useSessionStatusStore } from '../store/useSessionStatusStore';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { maxWidth } from '../styles/breakpoints';
import { LIVE_STATUS, getTrackInfo, TRACK_NAMES } from '../constants/f1';
import { TrackFlag } from './TrackFlag';
import { PromptChipBar } from './ai_engineer/PromptChipBar';
import { ChatMessageList } from './ai_engineer/ChatMessageList';
import { ChatSettingsDrawer } from './ai_engineer/ChatSettingsDrawer';
import { useDialogLayer } from './ui/useDialogLayer';
import { Badge, type BadgeProps } from './ui/Badge';
import { IconButton } from './ui/Button';
import styles from './AiRaceEngineer.module.css';

export interface AiRaceEngineerProps {
  // Optional overrides for standalone or test usage
  isOpenOverride?: boolean;
  onCloseOverride?: () => void;
}

/** Tallest the message box grows, in pixels, before it scrolls. */
const INPUT_MAX_HEIGHT_PX = 140;

/** On <html> while the chat is docked: the page makes room for it (--chat-dock-space). */
export const CHAT_DOCKED_ATTRIBUTE = 'data-chat-docked';

/** The session detail tabs, by the label the chat's header gives them. */
const FOCUS_LABEL_KEYS: Record<string, string> = {
  story: 'history.detail.tabStory',
  pace: 'history.detail.tabPace',
  position: 'history.detail.tabPosition',
  gap: 'history.detail.tabGap',
  stints: 'history.detail.tabStints',
  sectors: 'history.detail.tabSectors',
};

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

export const AiRaceEngineer: React.FC<AiRaceEngineerProps> = ({ isOpenOverride, onCloseOverride }) => {
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
  const isExpanded = useDevicePreferencesStore((s) => s.chatExpanded);
  const setIsExpanded = useDevicePreferencesStore((s) => s.setChatExpanded);
  const dockPreferred = useDevicePreferencesStore((s) => s.chatDocked);
  const setDockPreferred = useDevicePreferencesStore((s) => s.setChatDocked);
  // Docking needs a window wider than a laptop breakpoint; narrower ones keep the floating chat
  const canDock = !useMediaQuery(maxWidth('laptop'));
  const isDocked = isOpen && dockPreferred && canDock;
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  // A panel beside the page, not a modal: Esc closes it and focus goes back to the button that
  // opened it (or the launcher), but Tab can still leave it. The message box takes focus itself.
  useDialogLayer({
    isOpen,
    onClose: handleClose,
    containerRef: widgetRef,
    autoFocus: false,
    returnFocusRef: fabRef,
  });

  // While docked the page makes room for the chat instead of sitting under it
  useEffect(() => {
    if (!isDocked) return;
    const root = document.documentElement;
    root.setAttribute(CHAT_DOCKED_ATTRIBUTE, '');
    return () => root.removeAttribute(CHAT_DOCKED_ATTRIBUTE);
  }, [isDocked]);

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

  // What the engineer is looking at: a badge and the track or state beside it
  const context = useMemo((): {
    label: string;
    sub: string;
    track: string | null;
    badge: Pick<BadgeProps, 'tone' | 'color'>;
  } => {
    if (effectiveMode === 'comparator') {
      const track = comparatorTarget?.trackName || null;
      return {
        label: t('ai_engineer.badges.comparator'),
        sub: track || t('ai_engineer.selectLaps'),
        track,
        badge: { tone: 'accent' },
      };
    }
    if (effectiveMode === 'session_debrief' && sessionDebriefTarget) {
      const { focus } = sessionDebriefTarget;
      const session = sessionDebriefTarget.trackName || t('ai_engineer.modeDebrief');
      return {
        label: t('ai_engineer.badges.debrief'),
        // The tab open in the session is what the engineer looks at first
        sub: focus ? `${session} · ${t(FOCUS_LABEL_KEYS[focus])}` : session,
        track: sessionDebriefTarget.trackName,
        badge: { color: 'var(--f1-gold)' },
      };
    }
    if (effectiveMode === 'live') {
      const track = isLiveStandby ? null : liveTrackName;
      return {
        label: t('ai_engineer.badges.liveWall'),
        sub: track || t('ai_engineer.liveSessionStandby'),
        track,
        badge: { tone: 'success' },
      };
    }
    return {
      label: t('ai_engineer.badges.standby'),
      sub: t('ai_engineer.telemetryReady'),
      track: null,
      badge: { tone: 'neutral' },
    };
  }, [effectiveMode, comparatorTarget, sessionDebriefTarget, isLiveStandby, liveTrackName, t]);

  if (!isOpen) {
    return (
      <button
        ref={fabRef}
        type="button"
        className={styles.launcher}
        onClick={toggleChat}
        aria-label={t('ai_engineer.openChat')}
      >
        <span className={styles.launcherIcon} aria-hidden="true">
          <Bot size={22} />
          <span className={styles.pulse} />
        </span>
        <span className={styles.launcherLabel}>{t('ai_engineer.roleEngineer')}</span>
      </button>
    );
  }

  const expandLabel = isExpanded ? t('ai_engineer.collapse') : t('ai_engineer.expand');

  // When open: the chat panel, floating with no backdrop or docked beside the page, so the page
  // stays usable next to it
  return (
    <div
      ref={widgetRef}
      className={styles.widget}
      data-expanded={isExpanded}
      data-docked={isDocked}
      role={isDocked ? 'complementary' : 'dialog'}
      aria-labelledby={titleId}
    >
      {/* The chat behind the settings layer is out of reach while settings are open */}
      <div className={styles.content} inert={showSettings}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              <Bot size={18} />
            </span>
            <div className={styles.heading}>
              <div className={styles.titleRow}>
                <h2 className={styles.title} id={titleId}>
                  {t('ai_engineer.widgetTitle')}
                </h2>
                <Badge {...context.badge} size="xs" square uppercase>
                  {context.label}
                </Badge>
              </div>
              <div className={styles.context}>
                {context.track && <TrackFlag track={context.track} width={13} height={9} />}
                <span className={styles.contextName}>{context.sub}</span>
                <span className={styles.separator} aria-hidden="true">
                  •
                </span>
                <button
                  type="button"
                  className={styles.modelChip}
                  onClick={() => setShowSettings(true)}
                  title={config.model ? `${providerName} · ${config.model}` : providerName}
                >
                  {config.model || providerName}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <IconButton
              size="sm"
              label={t('ai_engineer.settings')}
              aria-pressed={showSettings}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={15} />
            </IconButton>
            <IconButton size="sm" label={t('ai_engineer.clearChat')} onClick={clearMessages}>
              <RotateCcw size={15} />
            </IconButton>
            {canDock && (
              <IconButton
                size="sm"
                label={t('ai_engineer.dock')}
                aria-pressed={isDocked}
                onClick={() => setDockPreferred(!isDocked)}
              >
                {isDocked ? <PanelRightClose size={15} /> : <PanelRight size={15} />}
              </IconButton>
            )}
            {!isDocked && (
              <IconButton size="sm" label={expandLabel} onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </IconButton>
            )}
            <IconButton size="sm" label={t('ai_engineer.close')} className={styles.close} onClick={handleClose}>
              <X size={16} />
            </IconButton>
          </div>
        </div>

        <PromptChipBar
          effectiveMode={effectiveMode}
          hasLapsSelected={hasLapsSelected}
          isZoomActive={isZoomActive}
          hasDebriefSession={sessionDebriefTarget !== null}
          isLiveStandby={isLiveStandby}
          isGenerating={isGenerating}
          onSelectPrompt={handlePromptChipClick}
        />

        <ChatMessageList
          messages={messages}
          isGenerating={isGenerating}
          defaultProvider={config.provider}
          onRetry={retryLastMessage}
          onOpenSettings={() => setShowSettings(true)}
        />

        <div className={styles.inputBar}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <textarea
              ref={inputRef}
              rows={1}
              className={styles.input}
              placeholder={getChatPlaceholder(effectiveMode, t)}
              aria-label={t('ai_engineer.messageLabel')}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isGenerating}
              title={t('ai_engineer.inputHint')}
            />

            {isGenerating ? (
              <button
                type="button"
                className={styles.send}
                data-stop
                onClick={stopGenerating}
                title={t('ai_engineer.stop')}
                aria-label={t('ai_engineer.stop')}
              >
                <Square size={13} />
              </button>
            ) : (
              <button
                type="submit"
                className={styles.send}
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

      {/* Settings layer over the whole widget */}
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
    </div>
  );
};
