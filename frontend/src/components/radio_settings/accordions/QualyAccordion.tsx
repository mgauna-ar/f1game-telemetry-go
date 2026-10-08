import React from 'react';
import { Timer } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface QualyAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const QualyAccordion: React.FC<QualyAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
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
  const subQualyResult = useRadioSettingsStore((s) => s.subQualyResult);
  const setSubQualyResult = useRadioSettingsStore((s) => s.setSubQualyResult);
  const qualyCleanAirSec = useRadioSettingsStore((s) => s.qualyCleanAirSec);
  const setQualyCleanAirSec = useRadioSettingsStore((s) => s.setQualyCleanAirSec);
  const qualyCarBehindSec = useRadioSettingsStore((s) => s.qualyCarBehindSec);
  const setQualyCarBehindSec = useRadioSettingsStore((s) => s.setQualyCarBehindSec);

  return (
    <SubsystemAccordion
      id="qualy"
      title={t('ai_engineer.proactiveAlerts.qualyTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.qualyDesc')}
      icon={<Timer size={16} />}
      tone="yellow"
      masterEnabled={qualyAlertsEnabled}
      onToggleMaster={setQualyAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.qualyTraffic')}
          checked={subQualyTraffic}
          onChange={setSubQualyTraffic}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.qualyDeletedLap')}
          checked={subQualyInvalid}
          onChange={setSubQualyInvalid}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.qualySessionTime')}
          checked={subQualyTime}
          onChange={setSubQualyTime}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.qualyElimDanger')}
          checked={subQualyElim}
          onChange={setSubQualyElim}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.qualyLapResult')}
          checked={subQualyResult}
          onChange={setSubQualyResult}
        />
      </div>

      <div className={styles.grid2}>
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.qualyCleanAirGap')}
          value={qualyCleanAirSec}
          unit="s"
          min={1.5}
          max={7.0}
          step={0.5}
          formatValue={(v) => `${v.toFixed(1)}s`}
          onChange={setQualyCleanAirSec}
        />
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.qualyCarBehindGap')}
          value={qualyCarBehindSec}
          unit="s"
          min={3}
          max={10}
          step={0.5}
          formatValue={(v) => `${v.toFixed(1)}s`}
          onChange={setQualyCarBehindSec}
        />
      </div>
    </SubsystemAccordion>
  );
};
