import React, { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { renderSimpleMarkdown } from '../../utils/markdown';
import { ChatErrorCard } from './ChatErrorCard';
import type { ChatMessage } from '../../types/ai';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  defaultProvider: string;
  onRetry: (messageId: string) => void;
  onOpenSettings: () => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isGenerating,
  defaultProvider,
  onRetry,
  onOpenSettings,
}) => {
  const { t } = useI18n();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const renderFormattedMarkdown = (content: string) => {
    return renderSimpleMarkdown(content, {
      containerClassName: 'chat-markdown',
      heading2ClassName: 'chat-h3',
      heading3ClassName: 'chat-h4',
      bulletItemClassName: 'chat-bullet',
      bulletDotClassName: 'chat-bullet-dot',
      paragraphClassName: 'chat-p',
      strongStyle: { color: '#fff', fontWeight: 600 },
    });
  };

  return (
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
                <ChatErrorCard
                  message={m}
                  defaultProvider={defaultProvider}
                  isGenerating={isGenerating}
                  onRetry={onRetry}
                  onOpenSettings={onOpenSettings}
                />
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
  );
};
