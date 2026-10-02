import React from 'react';
import { Users } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SubsystemAccordion } from '../SubsystemAccordion';
import { ToggleRow } from '../SettingControls';
import styles from '../RadioSettings.module.css';
import { useRadioSettingsStore } from '../../../store/useRadioSettingsStore';

interface TeammateAccordionProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTestAlert: () => void;
}

export const TeammateAccordion: React.FC<TeammateAccordionProps> = ({ isExpanded, onToggleExpand, onTestAlert }) => {
  const { t } = useI18n();

  const teammateAlertsEnabled = useRadioSettingsStore((s) => s.teammateAlertsEnabled);
  const setTeammateAlertsEnabled = useRadioSettingsStore((s) => s.setTeammateAlertsEnabled);
  const subTeammateAhead = useRadioSettingsStore((s) => s.subTeammateAhead);
  const setSubTeammateAhead = useRadioSettingsStore((s) => s.setSubTeammateAhead);
  const subTeammatePit = useRadioSettingsStore((s) => s.subTeammatePit);
  const setSubTeammatePit = useRadioSettingsStore((s) => s.setSubTeammatePit);

  return (
    <SubsystemAccordion
      id="teammate"
      title={t('ai_engineer.proactiveAlerts.teammateTitle')}
      subtitle={t('ai_engineer.proactiveAlerts.teammateDesc')}
      icon={<Users size={16} />}
      tone="purple"
      masterEnabled={teammateAlertsEnabled}
      onToggleMaster={setTeammateAlertsEnabled}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onTestAlert={onTestAlert}
    >
      <div className={styles.toggleGrid}>
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.teammateAhead')}
          checked={subTeammateAhead}
          onChange={setSubTeammateAhead}
        />
        <ToggleRow
          compact
          label={t('ai_engineer.proactiveAlerts.teammatePit')}
          checked={subTeammatePit}
          onChange={setSubTeammatePit}
        />
      </div>
    </SubsystemAccordion>
  );
};
