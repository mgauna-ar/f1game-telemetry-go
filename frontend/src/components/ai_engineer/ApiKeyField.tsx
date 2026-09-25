import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { AIKeyStatus, AIProvider } from '../../context/RaceEngineerContext';

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

  let statusClass = 'is-missing';
  let statusLabel = optional ? t('ai_engineer.setup.noKeyNeeded') : t('ai_engineer.setup.noKey');
  if (status.hasSavedKey) {
    statusClass = 'is-ready';
    statusLabel = t('ai_engineer.apiKeySaved');
  } else if (status.hasEnvKey) {
    statusClass = 'is-env';
    statusLabel = t('ai_engineer.serverEnvActive');
  } else if (optional) {
    statusClass = 'is-neutral';
  }

  let placeholder = t('ai_engineer.enterApiKey');
  if (status.hasSavedKey) placeholder = t('ai_engineer.apiKeySavedPlaceholder');
  else if (status.hasEnvKey) placeholder = t('ai_engineer.usingServerKey');

  const hasDraft = draftKey.trim() !== '';

  return (
    <div className="ai-field">
      <div className="ai-field-label-row">
        <label className="ai-field-label" htmlFor={`ai-key-${provider}`}>
          {optional ? t('ai_engineer.setup.apiKeyOptional') : t('ai_engineer.apiKey')}
        </label>
        <span className={`ai-key-status ${statusClass}`}>
          <span className="ai-status-dot" />
          {statusLabel}
        </span>
      </div>

      <div className="ai-key-row">
        <div className="ai-input-shell">
          <input
            id={`ai-key-${provider}`}
            type={showKey ? 'text' : 'password'}
            className="ai-input"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hasDraft) store(draftKey);
            }}
          />
          <button
            type="button"
            className="ai-input-icon-btn"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {hasDraft ? (
          <button
            type="button"
            className="ai-btn ai-btn-primary"
            onClick={() => store(draftKey)}
            disabled={isSaving}
            aria-label={t('ai_engineer.saveApiKey')}
          >
            {t('ai_engineer.setup.save')}
          </button>
        ) : (
          status.hasSavedKey && (
            <button
              type="button"
              className="ai-btn ai-btn-ghost-danger"
              onClick={() => store('')}
              disabled={isSaving}
              aria-label={t('ai_engineer.removeApiKey')}
              title={t('ai_engineer.removeApiKey')}
            >
              {t('ai_engineer.setup.remove')}
            </button>
          )
        )}
      </div>

      {error ? (
        <div className="ai-field-hint is-error">{error}</div>
      ) : (
        <div className="ai-field-hint">{hint ?? t('ai_engineer.apiKeyStoredHint')}</div>
      )}

      {keyLink && (
        <a className="ai-field-link" href={keyLink.url} target="_blank" rel="noopener noreferrer">
          <span>{keyLink.label}</span>
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
};
