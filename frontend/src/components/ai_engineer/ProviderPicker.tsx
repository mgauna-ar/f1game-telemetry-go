import React from 'react';
import { Asterisk, Hexagon, Server, Sparkles, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  AI_PROVIDER_OPTIONS,
  providerIsReady,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIProvider,
} from '../../context/RaceEngineerContext';

/** Icon and accent color of each provider's card. */
const PROVIDER_LOOK: Record<AIProvider, { icon: LucideIcon; color: string }> = {
  gemini: { icon: Sparkles, color: '#8ab4f8' },
  openai: { icon: Hexagon, color: '#10a37f' },
  claude: { icon: Asterisk, color: '#d97757' },
  custom: { icon: Server, color: '#00f2fe' },
};

export interface ProviderPickerProps {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  onSelect: (provider: AIProvider) => void;
}

/** The AI providers as cards, each saying whether it is ready to use. */
export const ProviderPicker: React.FC<ProviderPickerProps> = ({ config, keyStatus, onSelect }) => {
  const { t } = useI18n();
  const options = AI_PROVIDER_OPTIONS.some((option) => option.provider === config.provider)
    ? AI_PROVIDER_OPTIONS
    : [...AI_PROVIDER_OPTIONS, { provider: config.provider, nameKey: config.provider, taglineKey: '' }];

  return (
    <div className="ai-provider-grid" role="radiogroup" aria-label={t('ai_engineer.provider')}>
      {options.map((option) => {
        const look = PROVIDER_LOOK[option.provider] ?? PROVIDER_LOOK.custom;
        const Icon = look.icon;
        const selected = option.provider === config.provider;
        const ready = providerIsReady(config, keyStatus, option.provider);
        const needsLabel =
          option.provider === 'custom' ? t('ai_engineer.setup.needsAddress') : t('ai_engineer.setup.needsKey');
        return (
          <button
            key={option.provider}
            type="button"
            role="radio"
            aria-checked={selected}
            data-provider={option.provider}
            className={`ai-provider-card${selected ? ' is-selected' : ''}`}
            style={{ '--provider-color': look.color } as React.CSSProperties}
            onClick={() => onSelect(option.provider)}
          >
            <span className="ai-provider-icon">
              <Icon size={16} />
            </span>
            <span className="ai-provider-text">
              <span className="ai-provider-name">{t(option.nameKey)}</span>
              {option.taglineKey && <span className="ai-provider-tagline">{t(option.taglineKey)}</span>}
            </span>
            <span className={`ai-provider-status${ready ? ' is-ready' : ''}`}>
              <span className="ai-status-dot" />
              {ready ? t('ai_engineer.setup.ready') : needsLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};
