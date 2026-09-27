import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RadioPresetSelector } from './RadioPresetSelector';
import { SettingSection, ToggleRow } from './SettingControls';
import { ThresholdSlider } from './ThresholdSlider';
import styles from './RadioSettings.module.css';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

import { TyresAccordion } from './accordions/TyresAccordion';
import { DamageAccordion } from './accordions/DamageAccordion';
import { ErsAccordion } from './accordions/ErsAccordion';
import { BrakesAccordion } from './accordions/BrakesAccordion';
import { FuelAccordion } from './accordions/FuelAccordion';
import { RivalsAccordion } from './accordions/RivalsAccordion';
import { QualyAccordion } from './accordions/QualyAccordion';
import { FlagsAccordion } from './accordions/FlagsAccordion';

interface TacticalCoachingTabProps {
  radio: UseRadioControllerReturn;
}

export const TacticalCoachingTab: React.FC<TacticalCoachingTabProps> = ({ radio }) => {
  const { t } = useI18n();

  // Settings from Zustand store with fine-grained selectors
  const triggerPreset = useRadioSettingsStore((s) => s.triggerPreset);
  const applyTriggerPreset = useRadioSettingsStore((s) => s.applyTriggerPreset);
  const resetTriggerDefaults = useRadioSettingsStore((s) => s.resetTriggerDefaults);
  const smartDiscretionEnabled = useRadioSettingsStore((s) => s.smartDiscretionEnabled);
  const setSmartDiscretionEnabled = useRadioSettingsStore((s) => s.setSmartDiscretionEnabled);
  const chatterCooldownSeconds = useRadioSettingsStore((s) => s.chatterCooldownSeconds);
  const setChatterCooldownSeconds = useRadioSettingsStore((s) => s.setChatterCooldownSeconds);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    tyres: true,
    damage: false,
    ers: false,
    brakes: false,
    fuel: false,
    rivals: false,
    qualy: false,
    flags: false,
  });

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  return (
    <div className={styles.tab}>
      <RadioPresetSelector
        currentPreset={triggerPreset}
        onSelectPreset={applyTriggerPreset}
        onResetDefaults={resetTriggerDefaults}
      />

      {/* Smart discretion and how often the engineer talks */}
      <div className={styles.grid2}>
        <ToggleRow
          label={t('ai_engineer.triggers.smartDiscretion')}
          description={t('ai_engineer.triggers.smartDiscretionDesc')}
          checked={smartDiscretionEnabled}
          onChange={setSmartDiscretionEnabled}
        />
        <ThresholdSlider
          label={t('ai_engineer.triggers.chatterFrequency')}
          value={chatterCooldownSeconds}
          unit="s"
          min={10}
          max={120}
          step={5}
          onChange={setChatterCooldownSeconds}
        />
      </div>

      <SettingSection icon={<BellRing size={14} />} title={t('ai_engineer.proactiveAlerts.title')}>
        <div className={styles.stack}>
          {/* 1. TYRES */}
          <TyresAccordion
            isExpanded={!!expandedCategories.tyres}
            onToggleExpand={() => toggleCategory('tyres')}
            onTestAlert={() => radio.testTriggerAlert('tyres')}
          />

          {/* 2. DAMAGE */}
          <DamageAccordion
            isExpanded={!!expandedCategories.damage}
            onToggleExpand={() => toggleCategory('damage')}
            onTestAlert={() => radio.testTriggerAlert('damage')}
          />

          {/* 3. ERS */}
          <ErsAccordion
            isExpanded={!!expandedCategories.ers}
            onToggleExpand={() => toggleCategory('ers')}
            onTestAlert={() => radio.testTriggerAlert('ers')}
          />

          {/* 4. BRAKES */}
          <BrakesAccordion
            isExpanded={!!expandedCategories.brakes}
            onToggleExpand={() => toggleCategory('brakes')}
            onTestAlert={() => radio.testTriggerAlert('brakes')}
          />

          {/* 5. FUEL */}
          <FuelAccordion
            isExpanded={!!expandedCategories.fuel}
            onToggleExpand={() => toggleCategory('fuel')}
            onTestAlert={() => radio.testTriggerAlert('fuel')}
          />

          {/* 6. RIVALS */}
          <RivalsAccordion
            isExpanded={!!expandedCategories.rivals}
            onToggleExpand={() => toggleCategory('rivals')}
            onTestAlert={() => radio.testTriggerAlert('rivals')}
          />

          {/* 7. QUALIFYING */}
          <QualyAccordion
            isExpanded={!!expandedCategories.qualy}
            onToggleExpand={() => toggleCategory('qualy')}
            onTestAlert={() => radio.testTriggerAlert('qualy')}
          />

          {/* 8. FLAGS & RACE CONTROL */}
          <FlagsAccordion
            isExpanded={!!expandedCategories.flags}
            onToggleExpand={() => toggleCategory('flags')}
            onTestAlert={() => radio.testTriggerAlert('flags')}
          />
        </div>
      </SettingSection>
    </div>
  );
};
