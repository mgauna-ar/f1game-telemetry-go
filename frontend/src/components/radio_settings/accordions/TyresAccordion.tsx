import React from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface TyresAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const TyresAccordion: React.FC<TyresAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const tyreAlertsEnabled = useRadioSettingsStore((s) => s.tyreAlertsEnabled);
  const setTyreAlertsEnabled = useRadioSettingsStore((s) => s.setTyreAlertsEnabled);
  const subTyreWear = useRadioSettingsStore((s) => s.subTyreWear);
  const setSubTyreWear = useRadioSettingsStore((s) => s.setSubTyreWear);
  const subTyrePuncture = useRadioSettingsStore((s) => s.subTyrePuncture);
  const setSubTyrePuncture = useRadioSettingsStore((s) => s.setSubTyrePuncture);
  const subTyreThermal = useRadioSettingsStore((s) => s.subTyreThermal);
  const setSubTyreThermal = useRadioSettingsStore((s) => s.setSubTyreThermal);
  const subTyreCold = useRadioSettingsStore((s) => s.subTyreCold);
  const setSubTyreCold = useRadioSettingsStore((s) => s.setSubTyreCold);
  const tyreWearWarningPct = useRadioSettingsStore((s) => s.tyreWearWarningPct);
  const setTyreWearWarningPct = useRadioSettingsStore((s) => s.setTyreWearWarningPct);
  const tyreWearCriticalPct = useRadioSettingsStore((s) => s.tyreWearCriticalPct);
  const setTyreWearCriticalPct = useRadioSettingsStore((s) => s.setTyreWearCriticalPct);
  const tyreOverheatC = useRadioSettingsStore((s) => s.tyreOverheatC);
  const setTyreOverheatC = useRadioSettingsStore((s) => s.setTyreOverheatC);
  const tyreColdC = useRadioSettingsStore((s) => s.tyreColdC);
  const setTyreColdC = useRadioSettingsStore((s) => s.setTyreColdC);

  return (
    <SubsystemAccordion
      id="tyres"
      title={t('ai_engineer.proactiveAlerts.tyresTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.tyresDesc')}
      icon={<Gauge className="w-4 h-4" />}
      iconColorClass="text-cyan-400"
      masterEnabled={tyreAlertsEnabled}
      onToggleMaster={setTyreAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.tyreWearWarning')}</span>
          <input
            type="checkbox"
            checked={subTyreWear}
            onChange={(e) => setSubTyreWear(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.tyrePuncture')}</span>
          <input
            type="checkbox"
            checked={subTyrePuncture}
            onChange={(e) => setSubTyrePuncture(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.tyreThermalOverheat')}</span>
          <input
            type="checkbox"
            checked={subTyreThermal}
            onChange={(e) => setSubTyreThermal(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.tyreCold')}</span>
          <input
            type="checkbox"
            checked={subTyreCold}
            onChange={(e) => setSubTyreCold(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.tyreWearWarnThreshold')}</span>
            <span className="radio-badge-val">{tyreWearWarningPct}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            step={5}
            value={tyreWearWarningPct}
            onChange={(e) => setTyreWearWarningPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.tyreWearCritThreshold')}</span>
            <span className="radio-badge-val">{tyreWearCriticalPct}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={tyreWearCriticalPct}
            onChange={(e) => setTyreWearCriticalPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.tyreOverheatTemp')}</span>
            <span className="radio-badge-val">{tyreOverheatC}°C</span>
          </div>
          <input
            type="range"
            min={90}
            max={140}
            step={5}
            value={tyreOverheatC}
            onChange={(e) => setTyreOverheatC(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.tyreColdTemp')}</span>
            <span className="radio-badge-val">{tyreColdC}°C</span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={tyreColdC}
            onChange={(e) => setTyreColdC(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
