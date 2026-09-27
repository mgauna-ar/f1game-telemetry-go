import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AIKeyStatus, AIProvider } from '../../context/RaceEngineerContext';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { TextInput } from '../ui/Field';
import styles from './AiSettings.module.css';

export interface ApiKeyFieldProps {
  provider: AIProvider;
  status: AIKeyStatus;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  /** A key is optional, as for local servers. */
  optional?: boolean;
  /** Where to get a key, when there is a known place. */
  keyLink?: { url: string; label: string };
  hint?: string;
}

/**
 * The API key of one provider. Keys are write-only: a saved key stays on the server, so the field
 * only ever holds a new key and the saved one is only reported as saved.
 */
export const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  provider,
  status,
  saveApiKey,
  optional = false,
  keyLink,
  hint,
}) => {
  const { t } = useI18n();
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => {
    setDraftKey('');
    setError(null);
  }, [provider]);

  const store = async (value: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await saveApiKey(provider, value);
      setDraftKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai_engineer.apiKeySaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  let statusTone: BadgeTone = 'warning';
  let statusLabel = optional ? t('ai_engineer.setup.noKeyNeeded') : t('ai_engineer.setup.noKey');
  if (status.hasSavedKey) {
    statusTone = 'success';
    statusLabel = t('ai_engineer.apiKeySaved');
  } else if (status.hasEnvKey) {
    statusTone = 'info';
    statusLabel = t('ai_engineer.serverEnvActive');
  } else if (optional) {
    statusTone = 'neutral';
  }

  let placeholder = t('ai_engineer.enterApiKey');
  if (status.hasSavedKey) placeholder = t('ai_engineer.apiKeySavedPlaceholder');
  else if (status.hasEnvKey) placeholder = t('ai_engineer.usingServerKey');

  const hasDraft = draftKey.trim() !== '';

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={inputId}>
          {optional ? t('ai_engineer.setup.apiKeyOptional') : t('ai_engineer.apiKey')}
        </label>
        <Badge tone={statusTone} size="xs">
          {statusLabel}
        </Badge>
      </div>

      <div className={styles.keyRow}>
        <div className={styles.inputShell}>
          <TextInput
            id={inputId}
            type={showKey ? 'text' : 'password'}
            className={styles.withTrailing}
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            aria-describedby={hintId}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasDraft) store(draftKey);
            }}
          />
          <IconButton
            size="sm"
            className={styles.trailing}
            label={showKey ? t('ai_engineer.hideKey') : t('ai_engineer.showKey')}
            aria-pressed={showKey}
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </IconButton>
        </div>
        {hasDraft ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => store(draftKey)}
            loading={isSaving}
            aria-label={t('ai_engineer.saveApiKey')}
          >
            {t('ai_engineer.setup.save')}
          </Button>
        ) : (
          status.hasSavedKey && (
            <Button
              size="sm"
              className={styles.remove}
              onClick={() => store('')}
              loading={isSaving}
              aria-label={t('ai_engineer.removeApiKey')}
            >
              {t('ai_engineer.setup.remove')}
            </Button>
          )
        )}
      </div>

      <div id={hintId} className={styles.hint} role={error ? 'alert' : undefined}>
        {error ?? hint ?? t('ai_engineer.apiKeyStoredHint')}
      </div>

      {keyLink && (
        <a className={styles.link} href={keyLink.url} target="_blank" rel="noopener noreferrer">
          <span>{keyLink.label}</span>
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      )}
    </div>
  );
};
