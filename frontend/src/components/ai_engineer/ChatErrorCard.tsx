import React from 'react';
import {
  AlertTriangle,
  Key,
  Radio,
  WifiOff,
  RefreshCw,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import type { ChatMessage } from '../../types/ai';

export interface ChatErrorCardProps {
  message: ChatMessage;
  defaultProvider: string;
  isGenerating: boolean;
  onRetry: (messageId: string) => void;
  onOpenSettings: () => void;
}

export const ChatErrorCard: React.FC<ChatErrorCardProps> = ({
  message,
  defaultProvider,
  isGenerating,
  onRetry,
  onOpenSettings,
}) => {
  const { t } = useI18n();
  const code = message.errorCode || 'GENERIC_ERROR';
  const providerKey = (message.errorProvider || defaultProvider) as keyof typeof AI_PROVIDER_URLS;
  const providerInfo = AI_PROVIDER_URLS[providerKey] || AI_PROVIDER_URLS.gemini;

  let icon = <AlertTriangle size={15} color="#ff4b4b" />;
  let title = t('ai_engineer.errors.genericErrorTitle');
  let desc = message.errorRaw || t('ai_engineer.errors.genericErrorDesc');
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
        {message.canRetry && (
          <button
            type="button"
            className="ai-error-action-btn ai-error-action-primary"
            onClick={() => onRetry(message.id)}
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
          onClick={onOpenSettings}
        >
          <Settings size={11} />
          <span>{t('ai_engineer.openSettings')}</span>
        </button>
      </div>
    </div>
  );
};
