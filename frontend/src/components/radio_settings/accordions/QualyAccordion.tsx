import React from 'react';
import { Timer } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface QualyAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const QualyAccordion: React.FC<QualyAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const qualyAlertsEnabled = useRadioSettingsStore((s) => s.qualyAlertsEnabled);
  const setQualyAlertsEnabled = useRadioSettingsStore((s) => s.setQualyAlertsEnabled);
  const subQualyTraffic = useRadioSettingsStore((s) => s.subQualyTraffic);
  const setSubQualyTraffic = useRadioSettingsStore((s) => s.setSubQualyTraffic);
  const subQualyInvalid = useRadioSettingsStore((s) => s.subQualyInvalid);
  const setSubQualyInvalid = useRadioSettingsStore((s) => s.setSubQualyInvalid);
  const subQualyTime = useRadioSettingsStore((s) => s.subQualyTime);
  const setSubQualyTime = useRadioSettingsStore((s) => s.setSubQualyTime);
  const subQualyElim = useRadioSettingsStore((s) => s.subQualyElim);
  const setSubQualyElim = useRadioSettingsStore((s) => s.setSubQualyElim);
  const qualyCleanAirSec = useRadioSettingsStore((s) => s.qualyCleanAirSec);
  const setQualyCleanAirSec = useRadioSettingsStore((s) => s.setQualyCleanAirSec);

  return (
    <SubsystemAccordion
      id="qualy"
      title={t('ai_engineer.proactiveAlerts.qualyTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.qualyDesc')}
      icon={<Timer className="w-4 h-4" />}
      iconColorClass="text-yellow-400"
      masterEnabled={qualyAlertsEnabled}
      onToggleMaster={setQualyAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.qualyTraffic')}</span>
          <input
            type="checkbox"
            checked={subQualyTraffic}
            onChange={(e) => setSubQualyTraffic(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.qualyDeletedLap')}</span>
          <input
            type="checkbox"
            checked={subQualyInvalid}
            onChange={(e) => setSubQualyInvalid(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.qualySessionTime')}</span>
          <input
            type="checkbox"
            checked={subQualyTime}
            onChange={(e) => setSubQualyTime(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.qualyElimDanger')}</span>
          <input
            type="checkbox"
            checked={subQualyElim}
            onChange={(e) => setSubQualyElim(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.qualyCleanAirGap')}</span>
            <span className="radio-badge-val">{qualyCleanAirSec.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={1.5}
            max={7.0}
            step={0.5}
            value={qualyCleanAirSec}
            onChange={(e) => setQualyCleanAirSec(parseFloat(e.target.value))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
