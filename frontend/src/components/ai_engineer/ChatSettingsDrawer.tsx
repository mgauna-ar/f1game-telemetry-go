import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, ExternalLink, Check, Trash2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import { ModelSelectorDropdown, type ModelItem } from './ModelSelectorDropdown';
import {
  AI_PROVIDER_OPTIONS,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIProvider,
} from '../../context/RaceEngineerContext';

export interface ChatSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  saveConfig: (config: AIConfig) => void;
  keyStatus: AIKeyStatusByProvider;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  availableModels: ModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (cfg?: AIConfig) => Promise<void>;
}

export const ChatSettingsDrawer: React.FC<ChatSettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  saveConfig,
  keyStatus,
  saveApiKey,
  availableModels,
  isLoadingModels,
  modelsError,
  fetchAvailableModels,
}) => {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  // The key field is write-only: saved keys stay on the server, so it only ever holds a new key.
  const [draftKey, setDraftKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [draftBaseUrl, setDraftBaseUrl] = useState(config.baseUrl);

  useEffect(() => {
    setDraftKey('');
    setKeyError(null);
  }, [config.provider]);

  useEffect(() => {
    setDraftBaseUrl(config.baseUrl);
  }, [config.baseUrl]);

  if (!isOpen) return null;

  const status = keyStatus[config.provider];
  const providerUrl = AI_PROVIDER_URLS[config.provider];

  const storeKey = async (value: string) => {
    setIsSavingKey(true);
    setKeyError(null);
    try {
      await saveApiKey(config.provider, value);
      setDraftKey('');
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : t('ai_engineer.apiKeySaveFailed'));
    } finally {
      setIsSavingKey(false);
    }
  };

  const commitBaseUrl = () => {
    const baseUrl = draftBaseUrl.trim();
    if (baseUrl !== config.baseUrl) saveConfig({ ...config, baseUrl });
  };

  let keyPlaceholder = t('ai_engineer.enterApiKey');
  if (status.hasSavedKey) keyPlaceholder = t('ai_engineer.apiKeySavedPlaceholder');
  else if (status.hasEnvKey) keyPlaceholder = t('ai_engineer.usingServerKey');

  return (
    <div className="ai-widget-settings-panel glass-panel" data-testid="ai-settings-panel">
      <div className="ai-settings-header">
        <h4>{t('ai_engineer.settings')}</h4>
        <button className="ai-btn-icon" onClick={onClose} aria-label="Close settings">
          <X size={14} />
        </button>
      </div>

      <div className="ai-settings-body">
        <label className="readout-label">{t('ai_engineer.provider')}</label>
        <select
          className="ui-select"
          value={config.provider}
          onChange={(e) => {
            const provider = e.target.value as AIProvider;
            const updatedConfig: AIConfig = {
              ...config,
              provider,
              model: config.providerModels[provider],
            };
            saveConfig(updatedConfig);
            fetchAvailableModels(updatedConfig);
          }}
        >
          {AI_PROVIDER_OPTIONS.map((option) => (
            <option key={option.provider} value={option.provider}>
              {t(option.labelKey)}
            </option>
          ))}
          {/* A provider picked through .env or the API that the list doesn't offer yet */}
          {!AI_PROVIDER_OPTIONS.some((option) => option.provider === config.provider) && (
            <option value={config.provider}>{config.provider}</option>
          )}
        </select>

        <label className="readout-label" style={{ marginTop: '0.65rem' }}>
          {t('ai_engineer.apiKey')}
          {status.hasSavedKey && <span className="ai-env-badge">{t('ai_engineer.apiKeySaved')}</span>}
          {!status.hasSavedKey && status.hasEnvKey && (
            <span className="ai-env-badge">{t('ai_engineer.serverEnvActive')}</span>
          )}
        </label>
        <div className="ai-key-input-wrapper">
          <input
            type={showApiKey ? 'text' : 'password'}
            className="ui-input"
            autoComplete="off"
            placeholder={keyPlaceholder}
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draftKey.trim()) storeKey(draftKey);
            }}
          />
          <div className="ai-key-actions">
            <button
              type="button"
              className="ai-key-action-btn"
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            {draftKey.trim() && (
              <button
                type="button"
                className="ai-key-action-btn"
                onClick={() => storeKey(draftKey)}
                disabled={isSavingKey}
                aria-label={t('ai_engineer.saveApiKey')}
                title={t('ai_engineer.saveApiKey')}
              >
                <Check size={13} />
              </button>
            )}
            {status.hasSavedKey && !draftKey.trim() && (
              <button
                type="button"
                className="ai-key-action-btn delete"
                onClick={() => storeKey('')}
                disabled={isSavingKey}
                aria-label={t('ai_engineer.removeApiKey')}
                title={t('ai_engineer.removeApiKey')}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="ai-settings-hint">{keyError || t('ai_engineer.apiKeyStoredHint')}</div>

        {/* Direct Link to Get API Key for selected provider */}
        {providerUrl && (
          <div className="ai-settings-key-link">
            <a href={providerUrl.url} target="_blank" rel="noopener noreferrer">
              <span>
                {t(providerUrl.freeTier ? 'ai_engineer.getFreeApiKey' : 'ai_engineer.getApiKey', {
                  provider: providerUrl.name,
                })}
              </span>
              <ExternalLink size={11} />
            </a>
          </div>
        )}

        <ModelSelectorDropdown
          currentModel={config.model}
          availableModels={availableModels}
          isLoadingModels={isLoadingModels}
          modelsError={modelsError}
          onModelChange={(model) => saveConfig({ ...config, model })}
          onRefreshModels={() => fetchAvailableModels()}
        />

        {config.provider === 'custom' && (
          <>
            <label className="readout-label" style={{ marginTop: '0.65rem' }}>Base URL</label>
            <input
              type="text"
              className="ui-input"
              placeholder="https://api.openai.com/v1"
              value={draftBaseUrl}
              onChange={(e) => setDraftBaseUrl(e.target.value)}
              onBlur={commitBaseUrl}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitBaseUrl();
              }}
            />
            <div className="ai-settings-hint">{t('ai_engineer.baseUrlKeyHint')}</div>
          </>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
            onClick={() => {
              commitBaseUrl();
              onClose();
            }}
          >
            {t('ai_engineer.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
