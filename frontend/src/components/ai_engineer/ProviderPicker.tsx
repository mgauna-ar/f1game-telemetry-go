import React, { useRef } from 'react';
import { Asterisk, Hexagon, Server, Sparkles, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { nextRovingIndex } from '../ui/roving';
import { styleVars } from '../../styles/theme';
import {
  AI_PROVIDER_OPTIONS,
  providerIsReady,
  type AIConfig,
  type AIKeyStatusByProvider,
  type AIProvider,
} from '../../context/RaceEngineerContext';
import styles from './AiSettings.module.css';

/** Icon and brand colour of each provider's card. */
const PROVIDER_LOOK: Record<AIProvider, { icon: LucideIcon; color: string }> = {
  gemini: { icon: Sparkles, color: '#8ab4f8' },
  openai: { icon: Hexagon, color: '#10a37f' },
  claude: { icon: Asterisk, color: '#d97757' },
  custom: { icon: Server, color: 'var(--accent-cyan)' },
};

export interface ProviderPickerProps {
  config: AIConfig;
  keyStatus: AIKeyStatusByProvider;
  onSelect: (provider: AIProvider) => void;
}

/**
 * The AI providers as cards, each saying whether it is ready to use. A radio group: one Tab stop,
 * and the arrow keys move and select.
 */
export const ProviderPicker: React.FC<ProviderPickerProps> = ({ config, keyStatus, onSelect }) => {
  const { t } = useI18n();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = AI_PROVIDER_OPTIONS.some((option) => option.provider === config.provider)
    ? AI_PROVIDER_OPTIONS
    : [...AI_PROVIDER_OPTIONS, { provider: config.provider, nameKey: config.provider, taglineKey: '' }];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextRovingIndex(
      event.key,
      index,
      options.map(() => false)
    );
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onSelect(options[next].provider);
  };

  return (
    <div className={styles.providerGrid} role="radiogroup" aria-label={t('ai_engineer.provider')}>
      {options.map((option, index) => {
        const look = PROVIDER_LOOK[option.provider] ?? PROVIDER_LOOK.custom;
        const Icon = look.icon;
        const selected = option.provider === config.provider;
        const ready = providerIsReady(config, keyStatus, option.provider);
        const needsLabel =
          option.provider === 'custom' ? t('ai_engineer.setup.needsAddress') : t('ai_engineer.setup.needsKey');
        return (
          <button
            key={option.provider}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-provider={option.provider}
            className={styles.providerCard}
            style={styleVars({ '--provider-color': look.color })}
            onClick={() => onSelect(option.provider)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <span className={styles.providerIcon} aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className={styles.providerText}>
              <span className={styles.providerName}>{t(option.nameKey)}</span>
              {option.taglineKey && <span className={styles.providerTagline}>{t(option.taglineKey)}</span>}
            </span>
            <span className={styles.readiness} data-ready={ready || undefined}>
              {ready ? t('ai_engineer.setup.ready') : needsLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};
