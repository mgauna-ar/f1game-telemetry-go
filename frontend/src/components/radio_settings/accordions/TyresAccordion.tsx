import React from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
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
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.tyreWearWarnThreshold')}
          value={tyreWearWarningPct}
          unit="%"
          min={20}
          max={80}
          step={5}
          onChange={setTyreWearWarningPct}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.tyreWearCritThreshold')}
          value={tyreWearCriticalPct}
          unit="%"
          min={50}
          max={95}
          step={5}
          onChange={setTyreWearCriticalPct}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.tyreOverheatTemp')}
          value={tyreOverheatC}
          unit="°C"
          min={90}
          max={140}
          step={5}
          onChange={setTyreOverheatC}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.tyreColdTemp')}
          value={tyreColdC}
          unit="°C"
          min={50}
          max={100}
          step={5}
          onChange={setTyreColdC}
        />
      </div>
    </SubsystemAccordion>
  );
};
