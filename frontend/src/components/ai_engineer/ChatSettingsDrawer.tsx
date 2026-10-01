import React, { useId, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AI_PROVIDER_URLS } from '../../constants/f1';
import { ProviderPicker } from './ProviderPicker';
import { ApiKeyField } from './ApiKeyField';
import { ModelPicker } from './ModelPicker';
import { ServerAddressField } from './ServerAddressField';
import { findServerPreset } from '../../utils/aiServers';
import { SKIP_AUTOFOCUS_ATTRIBUTE, useDialogLayer } from '../ui/useDialogLayer';
import { Button, IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import { AllSettingsLink } from '../settings/AllSettingsLink';
import styles from './AiSettings.module.css';
import {
  AI_PROVIDER_OPTIONS,
  providerHasKey,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIModelItem,
  type AIProvider,
} from '../../context/RaceEngineerContext';

export interface AiSettingsFieldsProps {
  config: AIConfig;
  saveConfig: (config: AIConfig) => void;
  keyStatus: AIKeyStatusByProvider;
  saveApiKey: (provider: AIProvider, apiKey: string) => Promise<void>;
  availableModels: AIModelItem[];
  isLoadingModels: boolean;
  modelsError: string | null;
  fetchAvailableModels: (cfg?: AIConfig) => Promise<void>;
}

export interface ChatSettingsDrawerProps extends AiSettingsFieldsProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The AI settings fields. Pick a provider, then only that provider's fields show: a key and where
 * to get one for cloud providers, a server address (with presets) and an optional key for
 * OpenAI-compatible servers, and the provider's own model list. Every change saves at once to
 * the server, so all devices share it.
 */
export const AiSettingsFields: React.FC<AiSettingsFieldsProps> = ({
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
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('ai_engineer.provider')}</h3>
        <ProviderPicker config={config} keyStatus={keyStatus} onSelect={selectProvider} />
      </section>

      <section className={cx(styles.section, styles.providerPanel)} key={provider}>
        {option && (
          <div>
            <h3 className={styles.sectionTitle}>{t(option.nameKey)}</h3>
            <p className={styles.about}>{t(`ai_engineer.providers.${provider}.about`)}</p>
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
    </>
  );
};

/**
 * The AI settings, shown over the chat: a shortcut to the settings page's AI section. It is a
 * layer over the chat: Esc closes it before the chat, and focus moves into it and back to the
 * button that opened it.
 */
export const ChatSettingsDrawer: React.FC<ChatSettingsDrawerProps> = ({ isOpen, onClose, ...fields }) => {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialogLayer({ isOpen, onClose, containerRef: panelRef });

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
      data-testid="ai-settings-panel"
    >
      <div className={styles.head}>
        <IconButton
          size="sm"
          label={t('ai_engineer.closeSettings')}
          onClick={onClose}
          {...{ [SKIP_AUTOFOCUS_ATTRIBUTE]: true }}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <div>
          <h2 id={titleId} className={styles.title}>
            {t('ai_engineer.settings')}
          </h2>
          <p className={styles.subtitle}>{t('ai_engineer.setup.subtitle')}</p>
        </div>
      </div>

      <div className={styles.scroll}>
        <AiSettingsFields {...fields} />
      </div>

      <div className={styles.foot}>
        <span>{t('ai_engineer.setup.autosaveNote')}</span>
        <span className={styles.footActions}>
          <AllSettingsLink section="ai" onNavigate={onClose} />
          <Button variant="primary" size="sm" onClick={onClose}>
            {t('ai_engineer.done')}
          </Button>
        </span>
      </div>
    </div>
  );
};
