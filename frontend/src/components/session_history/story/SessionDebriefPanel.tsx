import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Sparkles, Square } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { useRaceEngineerActions, useRaceEngineerState } from '../../../context/RaceEngineerContextDefinitions';
import { useAIChatStream } from '../../../hooks/useAIChatStream';
import type { ChatContextRequest } from '../../../types/ai';
import { ChatErrorCard } from '../../ai_engineer/ChatErrorCard';
import { Button } from '../../ui/Button';
import { Markdown } from '../../ui/Markdown';
import { Panel, PanelHeader } from '../../ui/Panel';
import styles from './SessionDebriefPanel.module.css';

/**
 * Debriefs written in this tab, by session and your car in it, so switching tabs or sessions
 * doesn't lose them and picking another driver asks for a new one.
 */
const writtenDebriefs = new Map<string, string>();

interface SessionDebriefPanelProps {
  sessionId: number;
  /** Your car in the session; the debrief is about it. */
  playerCarIndex: number | null;
}

/**
 * The AI engineer's debrief of the session, written here instead of in the chat. The server
 * builds the same `session_debrief` context the chat uses (classification, your result and the
 * stored key moments). It only runs when asked, since it calls the AI provider.
 */
export const SessionDebriefPanel: React.FC<SessionDebriefPanelProps> = ({ sessionId, playerCarIndex }) => {
  const { t } = useI18n();
  const debriefKey = `${sessionId}:${playerCarIndex ?? 'none'}`;
  const { config, keyStatus } = useRaceEngineerState();
  const { openChat } = useRaceEngineerActions();
  const buildChatContext = useCallback(
    (): ChatContextRequest => ({ context_mode: 'session_debrief', session_id: sessionId }),
    [sessionId]
  );
  const { messages, isGenerating, sendMessage, retryLastMessage, stopGenerating, clearMessages } = useAIChatStream({
    config,
    keyStatus,
    buildChatContext,
  });
  const [saved, setSaved] = useState<string | undefined>(() => writtenDebriefs.get(debriefKey));

  const reply = [...messages].reverse().find((m) => m.role === 'assistant' && m.id.startsWith('assistant-'));
  const failed = !!reply?.errorCode;

  // Keep a finished debrief for this session
  useEffect(() => {
    if (!isGenerating && reply && !reply.errorCode && reply.content.trim()) {
      writtenDebriefs.set(debriefKey, reply.content);
    }
  }, [isGenerating, reply, debriefKey]);

  const write = () => {
    setSaved(undefined);
    writtenDebriefs.delete(debriefKey);
    clearMessages();
    void sendMessage(t('history.story.debriefPrompt'));
  };

  const content = reply && !failed ? reply.content : saved;

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        level={2}
        icon={<Sparkles size={16} />}
        title={t('history.story.debriefTitle')}
        subtitle={t('history.story.debriefSub')}
        actions={
          <div className={styles.actions}>
            {isGenerating ? (
              <Button size="sm" icon={<Square size={13} aria-hidden="true" />} onClick={stopGenerating}>
                {t('history.story.debriefStop')}
              </Button>
            ) : content ? (
              <Button size="sm" icon={<RefreshCw size={13} aria-hidden="true" />} onClick={write}>
                {t('history.story.debriefRewrite')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              icon={<MessageSquare size={13} aria-hidden="true" />}
              onClick={() => openChat()}
            >
              {t('history.story.debriefChat')}
            </Button>
          </div>
        }
      />
      {failed && reply ? (
        <ChatErrorCard
          message={reply}
          defaultProvider={config.provider}
          isGenerating={isGenerating}
          onRetry={(id) => void retryLastMessage(id)}
          onOpenSettings={() => openChat()}
        />
      ) : content ? (
        <div className={styles.body} aria-live="polite" aria-busy={isGenerating}>
          <Markdown content={content} className={styles.markdown} />
        </div>
      ) : isGenerating ? (
        <p className={styles.waiting} aria-live="polite">
          {t('history.story.debriefWriting')}
        </p>
      ) : (
        <div className={styles.empty}>
          <p>{t('history.story.debriefIntro')}</p>
          <Button variant="primary" icon={<Sparkles size={15} aria-hidden="true" />} onClick={write}>
            {t('history.story.debriefWrite')}
          </Button>
        </div>
      )}
    </Panel>
  );
};
