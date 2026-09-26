import React, { useEffect, useState } from 'react';
import { Radio, Sparkles, Sliders, BellRing, Power, Check, Play } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import { PersonaSettingsTab } from './radio_settings/PersonaSettingsTab';
import { AudioSettingsTab } from './radio_settings/AudioSettingsTab';
import { TacticalCoachingTab } from './radio_settings/TacticalCoachingTab';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './ui/Modal';
import { TabPanel, Tabs } from './ui/Tabs';

export type RadioSettingsTab = 'persona' | 'audio' | 'tactical';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
  /** Tab to show when the panel opens; without it the panel keeps the last tab shown. */
  initialTab?: RadioSettingsTab;
}

const TABS_ID = 'radio-settings';

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({
  isOpen,
  onClose,
  radio,
  initialTab,
}) => {
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

      <ModalBody className="radio-modal-body">
        {/* Master Enable/Disable Card */}
        <div className="radio-master-toggle-card">
          <div className="radio-master-toggle-info">
            <div className="radio-master-toggle-title-row">
              <Power
                size={16}
                color={radio.isRadioEnabled ? 'var(--status-success)' : 'var(--text-muted)'}
                aria-hidden="true"
              />
              <span className="radio-master-toggle-title">{t('ai_engineer.radio.masterToggle')}</span>
              <span className={`radio-master-status-badge ${radio.isRadioEnabled ? 'status-active' : 'status-off'}`}>
                {radio.isRadioEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="radio-master-toggle-desc">{t('ai_engineer.radio.masterToggleDesc')}</p>
          </div>
          <label className="radio-switch">
            <input
              type="checkbox"
              aria-label={t('ai_engineer.radio.masterToggle')}
              checked={radio.isRadioEnabled}
              onChange={(e) => radio.setIsRadioEnabled(e.target.checked)}
            />
            <span className="radio-switch-slider" />
          </label>
        </div>

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
        <button type="button" onClick={radio.testRadioTransmission} className="radio-btn-test">
          <Play size={16} aria-hidden="true" />
          {t('ai_engineer.radio.testRadio')}
        </button>
        <button type="button" onClick={onClose} className="radio-btn-done">
          <Check size={16} aria-hidden="true" />
          <span>{t('ai_engineer.done')}</span>
        </button>
      </ModalFooter>
    </Modal>
  );
};
