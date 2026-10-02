import React from 'react';
import { Fuel } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface FuelAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const FuelAccordion: React.FC<FuelAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();

  const fuelAlertsEnabled = useRadioSettingsStore((s) => s.fuelAlertsEnabled);
  const setFuelAlertsEnabled = useRadioSettingsStore((s) => s.setFuelAlertsEnabled);
  const subFuelDelta = useRadioSettingsStore((s) => s.subFuelDelta);
  const setSubFuelDelta = useRadioSettingsStore((s) => s.setSubFuelDelta);
  const subFuelMix = useRadioSettingsStore((s) => s.subFuelMix);
  const setSubFuelMix = useRadioSettingsStore((s) => s.setSubFuelMix);
  const fuelDeltaLaps = useRadioSettingsStore((s) => s.fuelDeltaLaps);
  const setFuelDeltaLaps = useRadioSettingsStore((s) => s.setFuelDeltaLaps);

  return (
    <SubsystemAccordion
      id="fuel"
      title={t('ai_engineer.proactiveAlerts.fuelTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.fuelDesc')}
      icon={<Fuel size={16} />}
      tone="green"
      masterEnabled={fuelAlertsEnabled}
      onToggleMaster={setFuelAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.fuelDeficitLiftCoast')}
          checked={subFuelDelta}
          onChange={setSubFuelDelta}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.fuelMix')}
          checked={subFuelMix}
          onChange={setSubFuelMix}
        />
      </div>

      <div className={styles.grid2}>
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.fuelDeltaThreshold')}
          value={fuelDeltaLaps}
          min={-3.0}
          max={0.0}
          step={0.1}
          formatValue={(v) => `${v > 0 ? `+${v}` : v} laps`}
          onChange={setFuelDeltaLaps}
        />
      </div>
    </SubsystemAccordion>
  );
};
