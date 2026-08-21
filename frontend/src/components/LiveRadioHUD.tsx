import React, { useState } from 'react';
import {
  Radio,
  Mic,
  Volume2,
  VolumeX,
  Settings,
  Loader2,
  Power,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { RADIO_PERSONAS } from '../constants/f1';
import { RadioSettingsPanel } from './RadioSettingsPanel';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';

export interface LiveRadioHUDProps {
  radio: UseRadioControllerReturn;
}

export const LiveRadioHUD: React.FC<LiveRadioHUDProps> = ({ radio }) => {
  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getPersonaLabel = () => {
    const langFlag = radio.effectiveLanguage === 'es' ? '🇦🇷' : '🇬🇧';
    switch (radio.persona) {
      case RADIO_PERSONAS.BONO:
        return { name: 'Bono', flag: langFlag };
      case RADIO_PERSONAS.CUSTOM:
        return { name: t('ai_engineer.personas.custom.name'), flag: '⚙️' };
      case RADIO_PERSONAS.COLAPINTO:
      default:
        return { name: 'Colapinto', flag: langFlag };
    }
  };

  const personaInfo = getPersonaLabel();

  // If radio is disabled, render compact minimized pill
  if (!radio.isRadioEnabled) {
    return (
      <>
        <div className="live-radio-hud-container">
          <div className="live-radio-pill state-off">
            <button
              type="button"
              onClick={() => radio.setIsRadioEnabled(true)}
              className="live-radio-power-btn"
              title={t('ai_engineer.radio.turnOn')}
            >
              <Power className="w-3.5 h-3.5" />
              <span className="live-radio-power-text">
                {t('ai_engineer.radio.turnOn')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="live-radio-btn"
              title={t('ai_engineer.radio.settings')}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <RadioSettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          radio={radio}
        />
      </>
    );
  }

  // State class determination
  let stateClass = '';
  let statusText = t('ai_engineer.radio.idle');

  if (radio.radioState === 'transmitting') {
    stateClass = 'state-transmitting';
    statusText = t('ai_engineer.radio.transmitting');
  } else if (radio.radioState === 'processing') {
    stateClass = 'state-processing';
    statusText = t('ai_engineer.radio.processing');
  } else if (radio.radioState === 'speaking') {
    stateClass = 'state-speaking';
    statusText = t('ai_engineer.radio.speaking', { name: personaInfo.name.toUpperCase() });
  }

  return (
    <>
      <div className="live-radio-hud-container">
        {/* Floating Radio Pill Widget */}
        <div className={`live-radio-pill ${stateClass}`}>
          {/* Radio Antenna / State Icon */}
          <div className="live-radio-icon-box">
            {radio.radioState === 'transmitting' ? (
              <Mic className="w-5 h-5 animate-bounce" />
            ) : radio.radioState === 'processing' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : radio.radioState === 'speaking' ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <Radio className="w-5 h-5" />
            )}
          </div>

          {/* Persona Chip & Radio Status */}
          <div className="live-radio-info">
            <div className="live-radio-status-row">
              <span className="live-radio-status-label">
                {statusText}
              </span>
              <span className="live-radio-flag">{personaInfo.flag}</span>
            </div>

            {/* Subtitle / PTT key helper */}
            <span className="live-radio-subtitle">
              {radio.radioState === 'speaking' && radio.lastResponse ? (
                <span title={radio.lastResponse}>
                  "{radio.lastResponse}"
                </span>
              ) : radio.radioState === 'transmitting' && radio.lastTranscript ? (
                <span>
                  {radio.lastTranscript}...
                </span>
              ) : (
                <>
                  <span className="live-radio-key-badge">
                    {radio.mappedKey}
                  </span>
                  <span>{t('ai_engineer.radio.pttHint', { key: radio.mappedKey })}</span>
                </>
              )}
            </span>
          </div>

          {/* Equalizer bars animation when speaking or transmitting */}
          {(radio.radioState === 'transmitting' || radio.radioState === 'speaking') && (
            <div className="live-radio-equalizer">
              <span className="live-radio-eq-bar" />
              <span className="live-radio-eq-bar" />
              <span className="live-radio-eq-bar" />
              <span className="live-radio-eq-bar" />
            </div>
          )}

          {/* Quick Action Controls */}
          <div className="live-radio-actions">
            {/* Mute / Unmute Volume */}
            <button
              type="button"
              onClick={() => radio.setVolume(radio.volume > 0 ? 0 : 0.8)}
              className="live-radio-btn"
              title={radio.volume > 0 ? t('ai_engineer.radio.mute') : t('ai_engineer.radio.unmute')}
            >
              {radio.volume > 0 ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" style={{ color: '#ef4444' }} />
              )}
            </button>

            {/* Turn Off Power Button */}
            <button
              type="button"
              onClick={() => radio.setIsRadioEnabled(false)}
              className="live-radio-btn btn-power-off"
              title={t('ai_engineer.radio.turnOff')}
            >
              <Power className="w-4 h-4" />
            </button>

            {/* Settings Gear */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="live-radio-btn"
              title={t('ai_engineer.radio.settings')}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <RadioSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        radio={radio}
      />
    </>
  );
};
