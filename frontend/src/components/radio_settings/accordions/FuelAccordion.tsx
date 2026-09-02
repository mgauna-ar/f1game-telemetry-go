import React from 'react';
import { Fuel } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface FuelAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const FuelAccordion: React.FC<FuelAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const fuelAlertsEnabled = useRadioSettingsStore((s) => s.fuelAlertsEnabled);
  const setFuelAlertsEnabled = useRadioSettingsStore((s) => s.setFuelAlertsEnabled);
  const subFuelDelta = useRadioSettingsStore((s) => s.subFuelDelta);
  const setSubFuelDelta = useRadioSettingsStore((s) => s.setSubFuelDelta);
  const fuelDeltaLaps = useRadioSettingsStore((s) => s.fuelDeltaLaps);
  const setFuelDeltaLaps = useRadioSettingsStore((s) => s.setFuelDeltaLaps);

  return (
    <SubsystemAccordion
      id="fuel"
      title={t('ai_engineer.proactiveAlerts.fuelTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.fuelDesc')}
      icon={<Fuel className="w-4 h-4" />}
      iconColorClass="text-emerald-400"
      masterEnabled={fuelAlertsEnabled}
      onToggleMaster={setFuelAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.fuelDeficitLiftCoast')}</span>
          <input
            type="checkbox"
            checked={subFuelDelta}
            onChange={(e) => setSubFuelDelta(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.fuelDeltaThreshold')}</span>
            <span className="radio-badge-val">{fuelDeltaLaps > 0 ? `+${fuelDeltaLaps}` : fuelDeltaLaps} laps</span>
          </div>
          <input
            type="range"
            min={-3.0}
            max={0.0}
            step={0.1}
            value={fuelDeltaLaps}
            onChange={(e) => setFuelDeltaLaps(parseFloat(e.target.value))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
