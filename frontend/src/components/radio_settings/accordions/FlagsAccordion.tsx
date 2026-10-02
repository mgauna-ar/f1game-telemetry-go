import React from 'react';
import { Flag } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface FlagsAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const FlagsAccordion: React.FC<FlagsAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
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
  const subFlags = useRadioSettingsStore((s) => s.subFlags);
  const setSubFlags = useRadioSettingsStore((s) => s.setSubFlags);
  const subRaceEvents = useRadioSettingsStore((s) => s.subRaceEvents);
  const setSubRaceEvents = useRadioSettingsStore((s) => s.setSubRaceEvents);
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
      icon={<Flag size={16} />}
      tone="green"
      masterEnabled={flagsPensAlertsEnabled}
      onToggleMaster={setFlagsPensAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.safetyCarAlert')}
          checked={subSafetyCar}
          onChange={setSubSafetyCar}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.redFlagAlert')}
          checked={subRedFlag}
          onChange={setSubRedFlag}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.dynamicRainAlert')}
          checked={subRain}
          onChange={setSubRain}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.trackLimitsWarning')}
          checked={subTrackLimits}
          onChange={setSubTrackLimits}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.penaltiesIncurred')}
          checked={subPenalties}
          onChange={setSubPenalties}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.flagsGeneral')}
          checked={subFlags}
          onChange={setSubFlags}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.raceEvents')}
          checked={subRaceEvents}
          onChange={setSubRaceEvents}
        />
      </div>

      <div className={styles.grid2}>
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.cornerCutLimit')}
          value={cornerCutWarnThreshold}
          min={1}
          max={3}
          step={1}
          onChange={setCornerCutWarnThreshold}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.rainHorizon')}
          value={rainHorizonMin}
          unit=" min"
          min={5}
          max={30}
          step={5}
          onChange={setRainHorizonMin}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.rainProbability')}
          value={rainProbPct}
          unit="%"
          min={20}
          max={80}
          step={5}
          onChange={setRainProbPct}
        />
      </div>
    </SubsystemAccordion>
  );
};
