import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Bot, Check, Copy } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { ChatMarkdown } from './ChatMarkdown';
import { ChatErrorCard } from './ChatErrorCard';
import type { ChatMessage } from '../../types/ai';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  defaultProvider: string;
  onRetry: (messageId: string) => void;
  onOpenSettings: () => void;
}

/** How close to the bottom, in pixels, still counts as reading the latest message. */
const BOTTOM_THRESHOLD_PX = 48;
/** Space left above a question when a reply scrolls it to the top. */
const QUESTION_TOP_GAP_PX = 8;
const COPIED_FEEDBACK_MS = 1500;

const formatTime = (date: Date): string =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text stays selectable.
    }
  };

  const label = copied ? t('ai_engineer.copied') : t('ai_engineer.copyReply');
  return (
    <button type="button" className="ai-message-action" onClick={copy} title={label} aria-label={label}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied && <span>{label}</span>}
    </button>
  );
};

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isGenerating,
  defaultProvider,
  onRetry,
  onOpenSettings,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Follow new text while the reader is at the bottom. For a new question, follow only until the
  // question reaches the top, so a long reply is read from its start instead of scrolling away.
  const followRef = useRef(true);
  const stopAtQuestionRef = useRef(false);
  const lastQuestionIdRef = useRef<string | null>(null);
  // Where this list last scrolled itself, to tell its own scrolling apart from the reader's.
  const ownScrollTopRef = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);

  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user');
  const lastQuestionId = lastQuestion?.id ?? null;

  const isAtBottom = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = isAtBottom(el);
    setShowJump(!atBottom);
    if (ownScrollTopRef.current !== null && Math.abs(el.scrollTop - ownScrollTopRef.current) < 2) return;
    ownScrollTopRef.current = null;
    if (!atBottom) {
      // The reader scrolled up, or the reply now keeps its question at the top.
      followRef.current = false;
      stopAtQuestionRef.current = false;
    } else if (!stopAtQuestionRef.current) {
      followRef.current = true;
    }
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (lastQuestionId !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = lastQuestionId;
      if (lastQuestionId) {
        followRef.current = true;
        stopAtQuestionRef.current = true;
      }
    }
    if (!followRef.current) {
      setShowJump(!isAtBottom(el));
      return;
    }

    const bottom = el.scrollHeight - el.clientHeight;
    let target = bottom;
    if (stopAtQuestionRef.current && lastQuestionId) {
      const row = Array.from(el.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        (node) => node.dataset.messageId === lastQuestionId
      );
      if (row) {
        const questionTop = row.offsetTop - QUESTION_TOP_GAP_PX;
        if (bottom >= questionTop) {
          // The reply fills the view: keep the question at the top and let the reader scroll.
          target = questionTop;
          stopAtQuestionRef.current = false;
          followRef.current = false;
        }
      }
    }
    el.scrollTop = target;
    ownScrollTopRef.current = el.scrollTop;
    setShowJump(!isAtBottom(el));
  }, [messages, isGenerating, lastQuestionId]);

  const jumpToLatest = () => {
    const el = containerRef.current;
    if (!el) return;
    stopAtQuestionRef.current = false;
    followRef.current = true;
    ownScrollTopRef.current = null;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  };

  return (
    <div className="ai-widget-messages-wrap">
      <div className="ai-widget-messages" ref={containerRef} onScroll={handleScroll}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          const isStreaming = isGenerating && !isUser && idx === messages.length - 1;
          const time = formatTime(m.timestamp);
          return (
            <div
              key={m.id}
              data-message-id={m.id}
              className={`ai-message-row ${isUser ? 'ai-user-row' : 'ai-assistant-row'}`}
            >
              {isUser ? (
                <div className="ai-message-bubble ai-user-bubble">
                  <div className="ai-user-text">{m.content}</div>
                  {time && <div className="ai-message-time mono">{time}</div>}
                </div>
              ) : (
                <div className="ai-assistant-message">
                  <div className="ai-message-meta">
                    <span className="ai-message-avatar">
                      <Bot size={12} />
                    </span>
                    <span className="ai-message-author">{t('ai_engineer.roleEngineer')}</span>
                    {time && <span className="ai-message-time mono">{time}</span>}
                    {m.content && !m.errorCode && !isStreaming && <CopyButton text={m.content} />}
                  </div>
                  <div className="ai-message-body">
                    {m.errorCode ? (
                      <ChatErrorCard
                        message={m}
                        defaultProvider={defaultProvider}
                        isGenerating={isGenerating}
                        onRetry={onRetry}
                        onOpenSettings={onOpenSettings}
                      />
                    ) : m.content ? (
                      <ChatMarkdown content={m.content} />
                    ) : isStreaming ? (
                      <div className="ai-typing-indicator">
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                        <span className="ai-dot" />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showJump && (
        <button type="button" className="ai-jump-latest" onClick={jumpToLatest}>
          <ArrowDown size={12} />
          <span>{t('ai_engineer.jumpToLatest')}</span>
        </button>
      )}
    </div>
  );
};
