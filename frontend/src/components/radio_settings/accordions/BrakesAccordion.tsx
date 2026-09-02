import React from 'react';
import { Flame } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface BrakesAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const BrakesAccordion: React.FC<BrakesAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const brakesAlertsEnabled = useRadioSettingsStore((s) => s.brakesAlertsEnabled);
  const setBrakesAlertsEnabled = useRadioSettingsStore((s) => s.setBrakesAlertsEnabled);
  const subBrakeTemp = useRadioSettingsStore((s) => s.subBrakeTemp);
  const setSubBrakeTemp = useRadioSettingsStore((s) => s.setSubBrakeTemp);
  const subBrakeCold = useRadioSettingsStore((s) => s.subBrakeCold);
  const setSubBrakeCold = useRadioSettingsStore((s) => s.setSubBrakeCold);
  const brakeOverheatC = useRadioSettingsStore((s) => s.brakeOverheatC);
  const setBrakeOverheatC = useRadioSettingsStore((s) => s.setBrakeOverheatC);
  const brakeColdC = useRadioSettingsStore((s) => s.brakeColdC);
  const setBrakeColdC = useRadioSettingsStore((s) => s.setBrakeColdC);

  return (
    <SubsystemAccordion
      id="brakes"
      title={t('ai_engineer.proactiveAlerts.brakesTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.brakesDesc')}
      icon={<Flame className="w-4 h-4" />}
      iconColorClass="text-orange-400"
      masterEnabled={brakesAlertsEnabled}
      onToggleMaster={setBrakesAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.brakeOverheatFade')}</span>
          <input
            type="checkbox"
            checked={subBrakeTemp}
            onChange={(e) => setSubBrakeTemp(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.brakeCold')}</span>
          <input
            type="checkbox"
            checked={subBrakeCold}
            onChange={(e) => setSubBrakeCold(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.brakeOverheatTemp')}</span>
            <span className="radio-badge-val">{brakeOverheatC}°C</span>
          </div>
          <input
            type="range"
            min={600}
            max={1200}
            step={50}
            value={brakeOverheatC}
            onChange={(e) => setBrakeOverheatC(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.brakeColdTemp')}</span>
            <span className="radio-badge-val">{brakeColdC}°C</span>
          </div>
          <input
            type="range"
            min={50}
            max={400}
            step={25}
            value={brakeColdC}
            onChange={(e) => setBrakeColdC(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
