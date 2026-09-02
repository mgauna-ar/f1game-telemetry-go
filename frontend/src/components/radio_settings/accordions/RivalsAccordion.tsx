import React from 'react';
import { Activity } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface RivalsAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const RivalsAccordion: React.FC<RivalsAccordionProps> = ({
  isExpanded,
  onToggleExpand,
  onTestAlert,
}) => {
  const { t } = useI18n();

  const rivalAlertsEnabled = useRadioSettingsStore((s) => s.rivalAlertsEnabled);
  const setRivalAlertsEnabled = useRadioSettingsStore((s) => s.setRivalAlertsEnabled);
  const subUndercut = useRadioSettingsStore((s) => s.subUndercut);
  const setSubUndercut = useRadioSettingsStore((s) => s.setSubUndercut);
  const subPitWindow = useRadioSettingsStore((s) => s.subPitWindow);
  const setSubPitWindow = useRadioSettingsStore((s) => s.setSubPitWindow);
  const subRivalDefend = useRadioSettingsStore((s) => s.subRivalDefend);
  const setSubRivalDefend = useRadioSettingsStore((s) => s.setSubRivalDefend);
  const subRivalAttack = useRadioSettingsStore((s) => s.subRivalAttack);
  const setSubRivalAttack = useRadioSettingsStore((s) => s.setSubRivalAttack);
  const undercutGapSec = useRadioSettingsStore((s) => s.undercutGapSec);
  const setUndercutGapSec = useRadioSettingsStore((s) => s.setUndercutGapSec);
  const rivalGapThresholdSec = useRadioSettingsStore((s) => s.rivalGapThresholdSec);
  const setRivalGapThresholdSec = useRadioSettingsStore((s) => s.setRivalGapThresholdSec);
  const rivalAheadGapSec = useRadioSettingsStore((s) => s.rivalAheadGapSec);
  const setRivalAheadGapSec = useRadioSettingsStore((s) => s.setRivalAheadGapSec);

  return (
    <SubsystemAccordion
      id="rivals"
      title={t('ai_engineer.proactiveAlerts.rivalsTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.rivalsDesc')}
      icon={<Activity className="w-4 h-4" />}
      iconColorClass="text-purple-400"
      masterEnabled={rivalAlertsEnabled}
      onToggleMaster={setRivalAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className="radio-sub-toggles-grid">
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.undercutThreat')}</span>
          <input
            type="checkbox"
            checked={subUndercut}
            onChange={(e) => setSubUndercut(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.pitWindowOpen')}</span>
          <input
            type="checkbox"
            checked={subPitWindow}
            onChange={(e) => setSubPitWindow(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.rivalDefend')}</span>
          <input
            type="checkbox"
            checked={subRivalDefend}
            onChange={(e) => setSubRivalDefend(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
        <label className="radio-sub-toggle-item">
          <span>{t('ai_engineer.proactiveAlerts.rivalAttack')}</span>
          <input
            type="checkbox"
            checked={subRivalAttack}
            onChange={(e) => setSubRivalAttack(e.target.checked)}
            className="radio-checkbox"
          />
        </label>
      </div>

      <div className="radio-ptt-grid">
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.undercutGapThreshold')}
          value={undercutGapSec}
          unit="s"
          min={1.0}
          max={5.0}
          step={0.5}
          formatValue={(v) => `${v.toFixed(1)}s`}
          onChange={setUndercutGapSec}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.rivalDefendGap')}
          value={rivalGapThresholdSec}
          unit="s"
          min={0.5}
          max={3.0}
          step={0.1}
          formatValue={(v) => `${v.toFixed(1)}s`}
          onChange={setRivalGapThresholdSec}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.rivalAttackGap')}
          value={rivalAheadGapSec}
          unit="s"
          min={0.5}
          max={3.0}
          step={0.1}
          formatValue={(v) => `${v.toFixed(1)}s`}
          onChange={setRivalAheadGapSec}
        />
      </div>
    </SubsystemAccordion>
  );
};
