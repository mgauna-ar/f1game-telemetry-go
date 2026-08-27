import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RADIO_TRIGGER_PRESETS, type RadioTriggerPreset } from '../../constants/f1';

interface RadioPresetSelectorProps {
  currentPreset: RadioTriggerPreset;
  onSelectPreset: (preset: RadioTriggerPreset) => void;
  onResetDefaults: () => void;
}

export const RadioPresetSelector: React.FC<RadioPresetSelectorProps> = ({
  currentPreset,
  onSelectPreset,
  onResetDefaults,
}) => {
  const { t } = useI18n();

  return (
    <div className="radio-preset-banner">
      <div className="radio-preset-header-row">
        <span className="radio-preset-title">
          <Sparkles className="w-3.5 h-3.5" />
          {t('ai_engineer.triggers.presetsTitle')}
        </span>
        <button
          type="button"
          onClick={onResetDefaults}
          className="radio-btn-reset"
          title={t('ai_engineer.triggers.resetDefaults')}
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t('ai_engineer.triggers.resetDefaults')}</span>
        </button>
      </div>

      <div className="radio-preset-grid">
        <button
          type="button"
          onClick={() => onSelectPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE)}
          className={`radio-preset-chip ${currentPreset === RADIO_TRIGGER_PRESETS.IMMERSIVE ? 'chip-active' : ''}`}
        >
          🏁 {t('ai_engineer.triggers.immersive')}
        </button>
        <button
          type="button"
          onClick={() => onSelectPreset(RADIO_TRIGGER_PRESETS.COACHING)}
          className={`radio-preset-chip ${currentPreset === RADIO_TRIGGER_PRESETS.COACHING ? 'chip-active' : ''}`}
        >
          ⚡ {t('ai_engineer.triggers.coaching')}
        </button>
        <button
          type="button"
          onClick={() => onSelectPreset(RADIO_TRIGGER_PRESETS.MINIMAL)}
          className={`radio-preset-chip ${currentPreset === RADIO_TRIGGER_PRESETS.MINIMAL ? 'chip-active' : ''}`}
        >
          🤫 {t('ai_engineer.triggers.minimalPreset')}
        </button>
        <button
          type="button"
          onClick={() => onSelectPreset(RADIO_TRIGGER_PRESETS.CUSTOM)}
          className={`radio-preset-chip ${currentPreset === RADIO_TRIGGER_PRESETS.CUSTOM ? 'chip-active' : ''}`}
        >
          🛠️ {t('ai_engineer.triggers.customPreset')}
        </button>
      </div>

      <p className="radio-preset-desc">
        {currentPreset === RADIO_TRIGGER_PRESETS.IMMERSIVE && t('ai_engineer.triggers.immersiveDesc')}
        {currentPreset === RADIO_TRIGGER_PRESETS.COACHING && t('ai_engineer.triggers.coachingDesc')}
        {currentPreset === RADIO_TRIGGER_PRESETS.MINIMAL && t('ai_engineer.triggers.minimalDesc')}
        {currentPreset === RADIO_TRIGGER_PRESETS.CUSTOM && t('ai_engineer.triggers.customDesc')}
      </p>
    </div>
  );
};
