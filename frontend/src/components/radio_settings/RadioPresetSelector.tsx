import React from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RADIO_TRIGGER_PRESETS, type RadioTriggerPreset } from '../../constants/f1';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SettingSection } from './SettingControls';
import styles from './RadioPresetSelector.module.css';

interface RadioPresetSelectorProps {
  currentPreset: RadioTriggerPreset;
  onSelectPreset: (preset: RadioTriggerPreset) => void;
  onResetDefaults: () => void;
}

const PRESETS: ReadonlyArray<{ value: RadioTriggerPreset; emoji: string; labelKey: string; descKey: string }> = [
  {
    value: RADIO_TRIGGER_PRESETS.IMMERSIVE,
    emoji: '🏁',
    labelKey: 'ai_engineer.triggers.immersive',
    descKey: 'ai_engineer.triggers.immersiveDesc',
  },
  {
    value: RADIO_TRIGGER_PRESETS.COACHING,
    emoji: '⚡',
    labelKey: 'ai_engineer.triggers.coaching',
    descKey: 'ai_engineer.triggers.coachingDesc',
  },
  {
    value: RADIO_TRIGGER_PRESETS.MINIMAL,
    emoji: '🤫',
    labelKey: 'ai_engineer.triggers.minimalPreset',
    descKey: 'ai_engineer.triggers.minimalDesc',
  },
  {
    value: RADIO_TRIGGER_PRESETS.CUSTOM,
    emoji: '🛠️',
    labelKey: 'ai_engineer.triggers.customPreset',
    descKey: 'ai_engineer.triggers.customDesc',
  },
];

export const RadioPresetSelector: React.FC<RadioPresetSelectorProps> = ({
  currentPreset,
  onSelectPreset,
  onResetDefaults,
}) => {
  const { t } = useI18n();
  const current = PRESETS.find((preset) => preset.value === currentPreset);

  return (
    <div className={styles.banner}>
      <SettingSection
        icon={<Sparkles size={14} />}
        title={t('ai_engineer.triggers.presetsTitle')}
        actions={
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} aria-hidden="true" />} onClick={onResetDefaults}>
            {t('ai_engineer.triggers.resetDefaults')}
          </Button>
        }
      >
        <SegmentedControl
          aria-label={t('ai_engineer.triggers.presetsTitle')}
          className={styles.presets}
          value={currentPreset}
          onChange={onSelectPreset}
          options={PRESETS.map((preset) => ({
            value: preset.value,
            label: `${preset.emoji} ${t(preset.labelKey)}`,
          }))}
        />
        {current && <p className={styles.description}>{t(current.descKey)}</p>}
      </SettingSection>
    </div>
  );
};
