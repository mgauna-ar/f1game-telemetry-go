import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RadioPresetSelector } from './RadioPresetSelector';
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
    <div className="radio-section">
      {/* Preset Selector */}
      <RadioPresetSelector
        currentPreset={triggerPreset}
        onSelectPreset={applyTriggerPreset}
        onResetDefaults={resetTriggerDefaults}
      />

      {/* Smart Discretion & Engineer Chatter Row */}
      <div className="radio-voice-grid" style={{ marginBottom: '6px' }}>
        <label className="radio-toggle-row" style={{ height: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>{t('ai_engineer.triggers.smartDiscretion')}</span>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>
              {t('ai_engineer.triggers.smartDiscretionDesc')}
            </span>
          </div>
          <input
            type="checkbox"
            checked={smartDiscretionEnabled}
            onChange={(e) => setSmartDiscretionEnabled(e.target.checked)}
            className="radio-checkbox"
          />
        </label>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('ai_engineer.triggers.chatterFrequency')}</span>
            <span className="radio-badge-val">{chatterCooldownSeconds}s</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={chatterCooldownSeconds}
            onChange={(e) => setChatterCooldownSeconds(parseInt(e.target.value, 10))}
            className="radio-slider-input"
            style={{ marginTop: '6px' }}
          />
        </div>
      </div>

      {/* Subsystems Accordion Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 2px' }}>
        <label className="radio-section-label" style={{ margin: 0 }}>
          <BellRing className="w-3.5 h-3.5" />
          {t('ai_engineer.proactiveAlerts.title')}
        </label>
      </div>

      <div className="radio-accordion-container">
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
    </div>
  );
};
