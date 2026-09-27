import React from 'react';
import { AlertTriangle, Key, Radio, WifiOff, RefreshCw, ExternalLink, Settings, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import type { ChatMessage } from '../../types/ai';
import { Button } from '../ui/Button';
import styles from './ChatErrorCard.module.css';

interface ErrorLook {
  icon: LucideIcon;
  /** Warnings (setup, a busy or missing model) are yellow; errors red. */
  tone: 'danger' | 'warning';
  titleKey: string;
  descKey: string;
  pulse?: boolean;
}

const ERRORS: Record<string, ErrorLook> = {
  MISSING_API_KEY: { icon: Key, tone: 'warning', titleKey: 'missingKeyTitle', descKey: 'missingKeyDesc' },
  MODEL_OVERLOADED: {
    icon: Radio,
    tone: 'warning',
    titleKey: 'modelOverloadedTitle',
    descKey: 'modelOverloadedDesc',
    pulse: true,
  },
  QUOTA_EXCEEDED: { icon: AlertTriangle, tone: 'danger', titleKey: 'quotaExceededTitle', descKey: 'quotaExceededDesc' },
  INVALID_API_KEY: { icon: Key, tone: 'danger', titleKey: 'invalidKeyTitle', descKey: 'invalidKeyDesc' },
  MODEL_NOT_FOUND: {
    icon: AlertTriangle,
    tone: 'warning',
    titleKey: 'modelNotFoundTitle',
    descKey: 'modelNotFoundDesc',
  },
  NETWORK_ERROR: { icon: WifiOff, tone: 'danger', titleKey: 'networkErrorTitle', descKey: 'networkErrorDesc' },
};

/** Errors that a new or different key fixes, so the card links to where to get one. */
const KEY_ERRORS = new Set(['MISSING_API_KEY', 'INVALID_API_KEY', 'QUOTA_EXCEEDED']);

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

  const look: ErrorLook | undefined = ERRORS[code];
  const Icon = look?.icon ?? AlertTriangle;
  const title = t(`ai_engineer.errors.${look?.titleKey ?? 'genericErrorTitle'}`);
  const desc = look
    ? t(`ai_engineer.errors.${look.descKey}`)
    : message.errorRaw || t('ai_engineer.errors.genericErrorDesc');

  return (
    <div className={styles.card} data-tone={look?.tone ?? 'danger'} data-testid="ai-error-card">
      <div className={styles.header}>
        <span className={styles.icon} data-pulse={look?.pulse || undefined} aria-hidden="true">
          <Icon size={15} />
        </span>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <p className={styles.desc}>{desc}</p>
      <div className={styles.actions}>
        {message.canRetry && (
          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw size={13} aria-hidden="true" />}
            loading={isGenerating}
            onClick={() => onRetry(message.id)}
          >
            {t('ai_engineer.retry')}
          </Button>
        )}
        {providerInfo && KEY_ERRORS.has(code) && (
          <a href={providerInfo.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t(providerInfo.freeTier ? 'ai_engineer.errors.getKeyButton' : 'ai_engineer.errors.getPaidKeyButton', {
              provider: providerInfo.name,
            })}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
        <Button size="sm" icon={<Settings size={13} aria-hidden="true" />} onClick={onOpenSettings}>
          {t('ai_engineer.openSettings')}
        </Button>
      </div>
    </div>
  );
};
