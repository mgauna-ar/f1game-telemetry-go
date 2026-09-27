import React from 'react';
import { Zap } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ThresholdSlider } from '../ThresholdSlider';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface ErsAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const ErsAccordion: React.FC<ErsAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();

  const ersAlertsEnabled = useRadioSettingsStore((s) => s.ersAlertsEnabled);
  const setErsAlertsEnabled = useRadioSettingsStore((s) => s.setErsAlertsEnabled);
  const subErsLow = useRadioSettingsStore((s) => s.subErsLow);
  const setSubErsLow = useRadioSettingsStore((s) => s.setSubErsLow);
  const ersLowPct = useRadioSettingsStore((s) => s.ersLowPct);
  const setErsLowPct = useRadioSettingsStore((s) => s.setErsLowPct);

  return (
    <SubsystemAccordion
      id="ers"
      title={t('ai_engineer.proactiveAlerts.ersTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.ersDesc')}
      icon={<Zap size={16} />}
      tone="amber"
      masterEnabled={ersAlertsEnabled}
      onToggleMaster={setErsAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.ersLowReserve')}
          checked={subErsLow}
          onChange={setSubErsLow}
        />
      </div>

      <div className={styles.grid2}>
        <ThresholdSlider
          label={t('ai_engineer.proactiveAlerts.ersLowThreshold')}
          value={ersLowPct}
          unit="%"
          min={5}
          max={40}
          step={5}
          onChange={setErsLowPct}
        />
      </div>
    </SubsystemAccordion>
  );
};
