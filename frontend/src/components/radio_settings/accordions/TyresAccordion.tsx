import React from 'react';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';
import { useUnits } from '../../../hooks/useUnits';

interface TyresAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const TyresAccordion: React.FC<TyresAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();
  const units = useUnits();

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
  const subTyreCondition = useRadioSettingsStore((s) => s.subTyreCondition);
  const setSubTyreCondition = useRadioSettingsStore((s) => s.setSubTyreCondition);
  const subTyreCrossover = useRadioSettingsStore((s) => s.subTyreCrossover);
  const setSubTyreCrossover = useRadioSettingsStore((s) => s.setSubTyreCrossover);
  const subTyreLife = useRadioSettingsStore((s) => s.subTyreLife);
  const setSubTyreLife = useRadioSettingsStore((s) => s.setSubTyreLife);
  const tyreWearWarningPct = useRadioSettingsStore((s) => s.tyreWearWarningPct);
  const setTyreWearWarningPct = useRadioSettingsStore((s) => s.setTyreWearWarningPct);
  const tyreWearCriticalPct = useRadioSettingsStore((s) => s.tyreWearCriticalPct);
  const setTyreWearCriticalPct = useRadioSettingsStore((s) => s.setTyreWearCriticalPct);
  const tyreTempMarginC = useRadioSettingsStore((s) => s.tyreTempMarginC);
  const setTyreTempMarginC = useRadioSettingsStore((s) => s.setTyreTempMarginC);

  return (
    <SubsystemAccordion
      id="tyres"
      title={t('ai_engineer.proactiveAlerts.tyresTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.tyresDesc')}
      icon={<Gauge size={16} />}
      tone="cyan"
      masterEnabled={tyreAlertsEnabled}
      onToggleMaster={setTyreAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreWearWarning')}
          checked={subTyreWear}
          onChange={setSubTyreWear}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyrePuncture')}
          checked={subTyrePuncture}
          onChange={setSubTyrePuncture}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreThermalOverheat')}
          checked={subTyreThermal}
          onChange={setSubTyreThermal}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreCold')}
          checked={subTyreCold}
          onChange={setSubTyreCold}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreCondition')}
          checked={subTyreCondition}
          onChange={setSubTyreCondition}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreCrossover')}
          checked={subTyreCrossover}
          onChange={setSubTyreCrossover}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreLife')}
          checked={subTyreLife}
          onChange={setSubTyreLife}
        />
      </div>

      <div className={styles.grid2}>
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
          label={t('ai_engineer.proactiveAlerts.tyreTempMargin')}
          value={tyreTempMarginC}
          formatValue={(c) =>
            `±${(units.temperatureValue(c) - units.temperatureValue(0)).toFixed(0)}${units.temperatureUnit}`
          }
          min={0}
          max={15}
          step={1}
          onChange={setTyreTempMarginC}
        />
      </div>
    </SubsystemAccordion>
  );
};
