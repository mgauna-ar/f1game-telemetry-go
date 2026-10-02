import React from 'react';
import { Wrench } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface PitAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const PitAccordion: React.FC<PitAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();

  const pitAlertsEnabled = useRadioSettingsStore((s) => s.pitAlertsEnabled);
  const setPitAlertsEnabled = useRadioSettingsStore((s) => s.setPitAlertsEnabled);
  const subPitWindow = useRadioSettingsStore((s) => s.subPitWindow);
  const setSubPitWindow = useRadioSettingsStore((s) => s.setSubPitWindow);
  const subPitWindowClose = useRadioSettingsStore((s) => s.subPitWindowClose);
  const setSubPitWindowClose = useRadioSettingsStore((s) => s.setSubPitWindowClose);
  const subPitCleanAir = useRadioSettingsStore((s) => s.subPitCleanAir);
  const setSubPitCleanAir = useRadioSettingsStore((s) => s.setSubPitCleanAir);
  const subTyreSet = useRadioSettingsStore((s) => s.subTyreSet);
  const setSubTyreSet = useRadioSettingsStore((s) => s.setSubTyreSet);
  const subPitLane = useRadioSettingsStore((s) => s.subPitLane);
  const setSubPitLane = useRadioSettingsStore((s) => s.setSubPitLane);
  const subPitEntryReminder = useRadioSettingsStore((s) => s.subPitEntryReminder);
  const setSubPitEntryReminder = useRadioSettingsStore((s) => s.setSubPitEntryReminder);
  const pitCallLeadM = useRadioSettingsStore((s) => s.pitCallLeadM);
  const setPitCallLeadM = useRadioSettingsStore((s) => s.setPitCallLeadM);

  return (
    <SubsystemAccordion
      id="pit"
      title={t('ai_engineer.proactiveAlerts.pitTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.pitDesc')}
      icon={<Wrench size={16} />}
      tone="orange"
      masterEnabled={pitAlertsEnabled}
      onToggleMaster={setPitAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.pitWindowOpen')}
          checked={subPitWindow}
          onChange={setSubPitWindow}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.pitWindowClose')}
          checked={subPitWindowClose}
          onChange={setSubPitWindowClose}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.pitCleanAir')}
          checked={subPitCleanAir}
          onChange={setSubPitCleanAir}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.tyreSet')}
          checked={subTyreSet}
          onChange={setSubTyreSet}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.pitLane')}
          checked={subPitLane}
          onChange={setSubPitLane}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.pitEntryReminder')}
          checked={subPitEntryReminder}
          onChange={setSubPitEntryReminder}
        />
      </div>

      <div className={styles.grid2}>
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.pitCallLead')}
          value={pitCallLeadM}
          unit="m"
          min={200}
          max={1500}
          step={50}
          onChange={setPitCallLeadM}
        />
      </div>
    </SubsystemAccordion>
  );
};
