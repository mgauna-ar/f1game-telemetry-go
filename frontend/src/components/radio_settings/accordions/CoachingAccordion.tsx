import React from 'react';
import { GraduationCap } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface CoachingAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const CoachingAccordion: React.FC<CoachingAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();

  const coachingAlertsEnabled = useRadioSettingsStore((s) => s.coachingAlertsEnabled);
  const setCoachingAlertsEnabled = useRadioSettingsStore((s) => s.setCoachingAlertsEnabled);
  const subSectorDelta = useRadioSettingsStore((s) => s.subSectorDelta);
  const setSubSectorDelta = useRadioSettingsStore((s) => s.setSubSectorDelta);
  const subStartProcedure = useRadioSettingsStore((s) => s.subStartProcedure);
  const setSubStartProcedure = useRadioSettingsStore((s) => s.setSubStartProcedure);
  const subInlapCooldown = useRadioSettingsStore((s) => s.subInlapCooldown);
  const setSubInlapCooldown = useRadioSettingsStore((s) => s.setSubInlapCooldown);

  return (
    <SubsystemAccordion
      id="coaching"
      title={t('ai_engineer.proactiveAlerts.coachingTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.coachingDesc')}
      icon={<GraduationCap size={16} />}
      tone="cyan"
      masterEnabled={coachingAlertsEnabled}
      onToggleMaster={setCoachingAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.sectorDelta')}
          checked={subSectorDelta}
          onChange={setSubSectorDelta}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.startProcedure')}
          checked={subStartProcedure}
          onChange={setSubStartProcedure}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.inlapCooldown')}
          checked={subInlapCooldown}
          onChange={setSubInlapCooldown}
        />
      </div>
    </SubsystemAccordion>
  );
};
