import React, { useState } from 'react';
import {
  X,
  Radio,
  Sparkles,
  Sliders,
  BellRing,
  Power,
  Check,
  Play,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import { PersonaSettingsTab } from './radio_settings/PersonaSettingsTab';
import { AudioSettingsTab } from './radio_settings/AudioSettingsTab';
import { TacticalCoachingTab } from './radio_settings/TacticalCoachingTab';

export interface RadioSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  radio: UseRadioControllerReturn;
}

type SettingsTab = 'persona' | 'audio' | 'tactical';

export const RadioSettingsPanel: React.FC<RadioSettingsPanelProps> = ({
  isOpen,
  onClose,
  radio,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('persona');

  if (!isOpen) return null;

  return (
    <div className="radio-modal-backdrop" onClick={onClose}>
      <div
        className="radio-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="radio-modal-header">
          <div className="radio-modal-header-left">
            <div className="radio-modal-header-icon">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="radio-modal-title">
                {t('ai_engineer.radio.settings')}
              </h2>
              <p className="radio-modal-subtitle">
                {t('ai_engineer.personas.title')} & Pit Wall Strategist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="radio-modal-close-btn"
            title={t('ai_engineer.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Enable/Disable Card */}
        <div className="radio-master-toggle-card">
          <div className="radio-master-toggle-info">
            <div className="radio-master-toggle-title-row">
              <Power className={`w-4 h-4 ${radio.isRadioEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="radio-master-toggle-title">
                {t('ai_engineer.radio.masterToggle')}
              </span>
              <span className={`radio-master-status-badge ${radio.isRadioEnabled ? 'status-active' : 'status-off'}`}>
                {radio.isRadioEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="radio-master-toggle-desc">
              {t('ai_engineer.radio.masterToggleDesc')}
            </p>
          </div>
          <label className="radio-switch">
            <input
              type="checkbox"
              checked={radio.isRadioEnabled}
              onChange={(e) => radio.setIsRadioEnabled(e.target.checked)}
            />
            <span className="radio-switch-slider" />
          </label>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="radio-tabs-nav">
          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'persona' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('persona')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.persona')}
          </button>

          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'audio' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            <Sliders className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.audio')}
          </button>

          <button
            type="button"
            className={`radio-tab-btn ${activeTab === 'tactical' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('tactical')}
          >
            <BellRing className="w-3.5 h-3.5" />
            {t('ai_engineer.tabs.tactical')}
          </button>
        </div>

        {/* Tab 1: Persona & Driver Callsign */}
        {activeTab === 'persona' && <PersonaSettingsTab radio={radio} />}

        {/* Tab 2: Voice, Audio Realism & PTT Controls */}
        {activeTab === 'audio' && <AudioSettingsTab radio={radio} />}

        {/* Tab 3: Telemetry Triggers, Presets & Tactical Coaching */}
        {activeTab === 'tactical' && <TacticalCoachingTab radio={radio} />}

        {/* Footer */}
        <div className="radio-modal-footer">
          <button
            type="button"
            onClick={radio.testRadioTransmission}
            className="radio-btn-test"
            title={t('ai_engineer.radio.testRadio')}
          >
            <Play className="w-4 h-4" />
            {t('ai_engineer.radio.testRadio')}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="radio-btn-done"
          >
            <Check className="w-4 h-4" />
            <span>{t('ai_engineer.done')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
