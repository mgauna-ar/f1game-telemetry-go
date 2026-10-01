import React from 'react';
import { Play } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useRadioController } from '../../hooks/useRadioController';
import { PersonaSettingsTab } from '../radio_settings/PersonaSettingsTab';
import { PttSettings, VoiceSettings } from '../radio_settings/AudioSettingsTab';
import { TacticalCoachingTab } from '../radio_settings/TacticalCoachingTab';
import { Button } from '../ui/Button';
import shared from '../radio_settings/RadioSettings.module.css';
import styles from './SettingsPage.module.css';

export interface RadioSettingsSectionsProps {
  section: 'voice' | 'alerts' | 'ptt';
}

/**
 * The race engineer's sections of the settings page: its persona and voice, its radio calls and
 * push-to-talk. They share the radio settings dialog's controls, and a radio to test them with.
 */
export const RadioSettingsSections: React.FC<RadioSettingsSectionsProps> = ({ section }) => {
  const { t } = useI18n();
  const radio = useRadioController();

  return (
    <div className={shared.tab}>
      {section === 'voice' && (
        <>
          <PersonaSettingsTab />
          <VoiceSettings radio={radio} />
          <div className={styles.sectionActions}>
            <Button icon={<Play size={15} aria-hidden="true" />} onClick={radio.testRadioTransmission}>
              {t('ai_engineer.radio.testRadio')}
            </Button>
          </div>
        </>
      )}
      {section === 'alerts' && <TacticalCoachingTab radio={radio} />}
      {section === 'ptt' && <PttSettings radio={radio} />}
    </div>
  );
};
