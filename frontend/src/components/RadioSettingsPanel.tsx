import React, { useEffect, useState } from 'react';
import { Radio, Sparkles, Sliders, BellRing, Power, Check, Play } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import { PersonaSettingsTab } from './radio_settings/PersonaSettingsTab';
import { AudioSettingsTab } from './radio_settings/AudioSettingsTab';
import { TacticalCoachingTab } from './radio_settings/TacticalCoachingTab';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { TabPanel, Tabs } from './ui/Tabs';
import styles from './RadioSettingsPanel.module.css';

export type RadioSettingsTab = 'persona' | 'audio' | 'tactical';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
  /** Tab to show when the panel opens; without it the panel keeps the last tab shown. */
  initialTab?: RadioSettingsTab;
}

const TABS_ID = 'radio-settings';

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({ isOpen, onClose, radio, initialTab }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<RadioSettingsTab>(initialTab ?? 'persona');

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader
        tone="accent"
        icon={<Radio size={20} />}
        title={t('ai_engineer.radio.settings')}
        subtitle={t('ai_engineer.radio.settingsSubtitle')}
      />

      <ModalBody className={styles.body}>
        {/* Master on/off: the whole card is the switch's label */}
        <label className={styles.master}>
          <span className={styles.masterText}>
            <span className={styles.masterTitleRow}>
              <Power size={16} className={styles.masterIcon} data-on={radio.isRadioEnabled} aria-hidden="true" />
              <span className={styles.masterTitle}>{t('ai_engineer.radio.masterToggle')}</span>
              <Badge tone={radio.isRadioEnabled ? 'success' : 'danger'} size="xs" square aria-hidden="true">
                {radio.isRadioEnabled ? 'ON' : 'OFF'}
              </Badge>
            </span>
            <span className={styles.masterDesc}>{t('ai_engineer.radio.masterToggleDesc')}</span>
          </span>
          <Switch size="md" tone="success" checked={radio.isRadioEnabled} onChange={radio.setIsRadioEnabled} />
        </label>

        <Tabs
          idPrefix={TABS_ID}
          aria-label={t('ai_engineer.radio.settings')}
          tone="accent"
          size="sm"
          stretch
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'persona', label: t('ai_engineer.tabs.persona'), icon: <Sparkles size={14} /> },
            { id: 'audio', label: t('ai_engineer.tabs.audio'), icon: <Sliders size={14} /> },
            { id: 'tactical', label: t('ai_engineer.tabs.tactical'), icon: <BellRing size={14} /> },
          ]}
        />

        <TabPanel idPrefix={TABS_ID} tab={activeTab}>
          {activeTab === 'persona' && <PersonaSettingsTab radio={radio} />}
          {activeTab === 'audio' && <AudioSettingsTab radio={radio} />}
          {activeTab === 'tactical' && <TacticalCoachingTab radio={radio} />}
        </TabPanel>
      </ModalBody>

      <ModalFooter align="between">
        <Button icon={<Play size={15} aria-hidden="true" />} onClick={radio.testRadioTransmission}>
          {t('ai_engineer.radio.testRadio')}
        </Button>
        <Button variant="primary" icon={<Check size={15} aria-hidden="true" />} onClick={onClose}>
          {t('ai_engineer.done')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
