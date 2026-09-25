import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import { ProviderPicker } from './ProviderPicker';
import { ApiKeyField } from './ApiKeyField';
import { ModelPicker } from './ModelPicker';
import { ServerAddressField } from './ServerAddressField';
import { findServerPreset } from '../../utils/aiServers';
import {
  AI_PROVIDER_OPTIONS,
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIModelItem,
  type AIProvider,
} from '../../context/RaceEngineerContext';

export interface ChatSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  saveConfig: (config: AIConfig) => void;
  keyStatus: AIKeyStatusByProvider;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (cfg?: AIConfig) => Promise<void>;
}

/**
 * The AI settings, shown over the chat. Pick a provider, then only that provider's fields show:
 * a key and where to get one for cloud providers, a server address (with presets) and an optional
 * key for OpenAI-compatible servers, and the provider's own model list. Every change saves at once
 * to the server, so all devices share it.
 */
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

  if (!isOpen) return null;

  const provider = config.provider;
  const isCustom = provider === 'custom';
  const option = AI_PROVIDER_OPTIONS.find((o) => o.provider === provider);
  const status = keyStatus[provider] ?? { hasSavedKey: false, hasEnvKey: false };

  const selectProvider = (next: AIProvider) => {
    if (next === provider) return;
    saveConfig({ ...config, provider: next, model: config.providerModels[next] });
  };

  let keyLink: { url: string; label: string } | undefined;
  let keyHint: string | undefined;
  if (isCustom) {
    const preset = findServerPreset(config.baseUrl);
    if (preset?.keyUrl) {
      keyLink = { url: preset.keyUrl, label: t('ai_engineer.setup.getKey', { provider: preset.name }) };
    }
    if (preset?.local) keyHint = t('ai_engineer.setup.localNoKey');
    else if (status.hasSavedKey) keyHint = t('ai_engineer.baseUrlKeyHint');
  } else {
    const site = AI_PROVIDER_URLS[provider];
    if (site) {
      keyLink = {
        url: site.url,
        label: t(site.freeTier ? 'ai_engineer.setup.getFreeKey' : 'ai_engineer.setup.getKey', { provider: site.name }),
      };
    }
  }

  let modelsUnavailable: string | null = null;
  if (isCustom && !config.baseUrl.trim()) modelsUnavailable = t('ai_engineer.setup.modelsNeedAddress');
  else if (!providerHasKey(keyStatus, provider)) modelsUnavailable = t('ai_engineer.setup.modelsNeedKey');

  return (
    <div className="ai-settings-panel" data-testid="ai-settings-panel">
      <div className="ai-settings-head">
        <button type="button" className="ai-btn-icon" onClick={onClose} aria-label="Close settings">
          <ArrowLeft size={16} />
        </button>
        <div className="ai-settings-head-text">
          <h4>{t('ai_engineer.settings')}</h4>
          <p>{t('ai_engineer.setup.subtitle')}</p>
        </div>
      </div>

      <div className="ai-settings-scroll">
        <section className="ai-settings-section">
          <div className="ai-section-title">{t('ai_engineer.provider')}</div>
          <ProviderPicker config={config} keyStatus={keyStatus} onSelect={selectProvider} />
        </section>

        <section className="ai-settings-section ai-provider-panel" key={provider}>
          {option && (
            <div className="ai-provider-panel-head">
              <div className="ai-section-title">{t(option.nameKey)}</div>
              <p className="ai-provider-about">{t(`ai_engineer.providers.${provider}.about`)}</p>
            </div>
          )}

          {isCustom && (
            <ServerAddressField baseUrl={config.baseUrl} onChange={(baseUrl) => saveConfig({ ...config, baseUrl })} />
          )}

          <ApiKeyField
            provider={provider}
            status={status}
            saveApiKey={saveApiKey}
            optional={isCustom}
            keyLink={keyLink}
            hint={keyHint}
          />

          <ModelPicker
            currentModel={config.model}
            availableModels={availableModels}
            isLoadingModels={isLoadingModels}
            modelsError={modelsUnavailable ? null : modelsError}
            unavailableReason={modelsUnavailable}
            onModelChange={(model) => saveConfig({ ...config, model })}
            onRefreshModels={() => fetchAvailableModels()}
          />
        </section>
      </div>

      <div className="ai-settings-foot">
        <span>{t('ai_engineer.setup.autosaveNote')}</span>
        <button type="button" className="ai-btn ai-btn-primary" onClick={onClose}>
          {t('ai_engineer.done')}
        </button>
      </div>
    </div>
  );
};
