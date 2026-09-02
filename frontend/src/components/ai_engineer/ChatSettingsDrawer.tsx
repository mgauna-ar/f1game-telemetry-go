import React, { useState } from 'react';
import { X, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import { ModelSelectorDropdown, type ModelItem } from './ModelSelectorDropdown';
import type { AIConfig } from '../../context/RaceEngineerContext';
import type { ServerConfigStatus } from '../../hooks/useAIModels';

export interface ChatSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  saveConfig: (config: AIConfig) => void;
  serverConfigStatus: ServerConfigStatus | null;
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
  serverConfigStatus,
  availableModels,
  isLoadingModels,
  modelsError,
  fetchAvailableModels,
}) => {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isOpen) return null;

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
            const prov = e.target.value as AIConfig['provider'];
            const nextKey = config.providerKeys?.[prov] || '';
            const nextModel =
              config.providerModels?.[prov] ||
              (prov === 'gemini' ? 'gemini-flash-lite-latest' : 'gpt-4o-mini');

            const updatedConfig: AIConfig = {
              ...config,
              provider: prov,
              apiKey: nextKey,
              model: nextModel,
            };
            saveConfig(updatedConfig);
            fetchAvailableModels(updatedConfig);
          }}
        >
          <option value="gemini">{t('ai_engineer.geminiOption')}</option>
          <option value="openai">{t('ai_engineer.openaiOption')}</option>
          <option value="custom">{t('ai_engineer.customOption')}</option>
        </select>

        <label className="readout-label" style={{ marginTop: '0.65rem' }}>
          {t('ai_engineer.apiKey')}
          {config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey && (
            <span className="ai-env-badge">{t('ai_engineer.serverEnvActive')}</span>
          )}
        </label>
        <div className="ai-input-with-icon">
          <input
            type={showApiKey ? 'text' : 'password'}
            className="ui-input"
            placeholder={
              (config.provider === 'gemini' && serverConfigStatus?.hasGeminiEnvKey) ||
              (config.provider === 'openai' && serverConfigStatus?.hasOpenAIEnvKey)
                ? t('ai_engineer.usingServerKey')
                : t('ai_engineer.enterApiKey')
            }
            value={config.apiKey}
            onChange={(e) => {
              const val = e.target.value;
              const updatedKeys = { ...(config.providerKeys || {}), [config.provider]: val };
              saveConfig({ ...config, apiKey: val, providerKeys: updatedKeys });
            }}
          />
          <button
            type="button"
            className="ai-input-action-btn"
            onClick={() => setShowApiKey(!showApiKey)}
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        {/* Direct Link to Get API Key for selected provider */}
        {AI_PROVIDER_URLS[config.provider] && (
          <div className="ai-settings-key-link">
            <a
              href={AI_PROVIDER_URLS[config.provider].url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                {t(
                  AI_PROVIDER_URLS[config.provider].freeTier
                    ? 'ai_engineer.getFreeApiKey'
                    : 'ai_engineer.getApiKey',
                  { provider: AI_PROVIDER_URLS[config.provider].name }
                )}
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
          onModelChange={(val) => {
            const updatedModels = { ...(config.providerModels || {}), [config.provider]: val };
            saveConfig({ ...config, model: val, providerModels: updatedModels });
          }}
          onRefreshModels={() => fetchAvailableModels()}
        />

        {config.provider === 'custom' && (
          <>
            <label className="readout-label" style={{ marginTop: '0.65rem' }}>Base URL</label>
            <input
              type="text"
              className="ui-input"
              placeholder="https://api.openai.com/v1"
              value={config.baseUrl}
              onChange={(e) => saveConfig({ ...config, baseUrl: e.target.value })}
            />
          </>
        )}

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
            onClick={onClose}
          >
            {t('ai_engineer.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
