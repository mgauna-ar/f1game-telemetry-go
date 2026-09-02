import React from 'react';
import { Flag } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface FlagsAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const FlagsAccordion: React.FC<FlagsAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const flagsPensAlertsEnabled = useRadioSettingsStore((s) => s.flagsPensAlertsEnabled);
  const setFlagsPensAlertsEnabled = useRadioSettingsStore((s) => s.setFlagsPensAlertsEnabled);
  const subSafetyCar = useRadioSettingsStore((s) => s.subSafetyCar);
  const setSubSafetyCar = useRadioSettingsStore((s) => s.setSubSafetyCar);
  const subRedFlag = useRadioSettingsStore((s) => s.subRedFlag);
  const setSubRedFlag = useRadioSettingsStore((s) => s.setSubRedFlag);
  const subRain = useRadioSettingsStore((s) => s.subRain);
  const setSubRain = useRadioSettingsStore((s) => s.setSubRain);
  const subTrackLimits = useRadioSettingsStore((s) => s.subTrackLimits);
  const setSubTrackLimits = useRadioSettingsStore((s) => s.setSubTrackLimits);
  const subPenalties = useRadioSettingsStore((s) => s.subPenalties);
  const setSubPenalties = useRadioSettingsStore((s) => s.setSubPenalties);
  const cornerCutWarnThreshold = useRadioSettingsStore((s) => s.cornerCutWarnThreshold);
  const setCornerCutWarnThreshold = useRadioSettingsStore((s) => s.setCornerCutWarnThreshold);
  const rainHorizonMin = useRadioSettingsStore((s) => s.rainHorizonMin);
  const setRainHorizonMin = useRadioSettingsStore((s) => s.setRainHorizonMin);
  const rainProbPct = useRadioSettingsStore((s) => s.rainProbPct);
  const setRainProbPct = useRadioSettingsStore((s) => s.setRainProbPct);

  return (
    <SubsystemAccordion
      id="flags"
      title={t('ai_engineer.proactiveAlerts.flagsTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.flagsDesc')}
      icon={<Flag className="w-4 h-4" />}
      iconColorClass="text-emerald-400"
      masterEnabled={flagsPensAlertsEnabled}
      onToggleMaster={setFlagsPensAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.safetyCarAlert')}</span>
          <input
            type="checkbox"
            checked={subSafetyCar}
            onChange={(e) => setSubSafetyCar(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.redFlagAlert')}</span>
          <input
            type="checkbox"
            checked={subRedFlag}
            onChange={(e) => setSubRedFlag(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.dynamicRainAlert')}</span>
          <input
            type="checkbox"
            checked={subRain}
            onChange={(e) => setSubRain(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.trackLimitsWarning')}</span>
          <input
            type="checkbox"
            checked={subTrackLimits}
            onChange={(e) => setSubTrackLimits(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.penaltiesIncurred')}</span>
          <input
            type="checkbox"
            checked={subPenalties}
            onChange={(e) => setSubPenalties(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.cornerCutLimit')}</span>
            <span className="radio-badge-val">{cornerCutWarnThreshold}</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={cornerCutWarnThreshold}
            onChange={(e) => setCornerCutWarnThreshold(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.rainHorizon')}</span>
            <span className="radio-badge-val">{rainHorizonMin} min</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={rainHorizonMin}
            onChange={(e) => setRainHorizonMin(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>

        <div className="radio-ptt-box">
          <div className="radio-ptt-box-header">
            <span>{t('ai_engineer.proactiveAlerts.rainProbability')}</span>
            <span className="radio-badge-val">{rainProbPct}%</span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            step={5}
            value={rainProbPct}
            onChange={(e) => setRainProbPct(parseInt(e.target.value, 10))}
            className="radio-slider-input"
          />
        </div>
      </div>
    </SubsystemAccordion>
  );
};
