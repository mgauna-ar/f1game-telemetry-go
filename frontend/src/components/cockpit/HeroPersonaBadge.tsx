import React from 'react';
import {
  Mic,
  Loader2,
  Radio,
  Volume2,
  VolumeX,
  Power,
  Settings,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RadioWaveformCanvas } from '../common/RadioWaveformCanvas';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';

export interface PersonaInfo {
  name: string;
  flag: string;
  role: string;
}

export interface HeroPersonaBadgeProps {
  personaInfo: PersonaInfo;
  statusHeroText: string;
  radio: UseRadioControllerReturn;
  volume: number;
  setVolume: (v: number) => void;
  onOpenSettings: () => void;
}

export const HeroPersonaBadge: React.FC<HeroPersonaBadgeProps> = ({
  personaInfo,
  statusHeroText,
  radio,
  volume,
  setVolume,
  onOpenSettings,
}) => {
  const { t } = useI18n();

  return (
    <div className="voice-cockpit-hero-header">
      {/* Persona Avatar & Info */}
      <div className="voice-cockpit-persona-box">
        <div className="voice-cockpit-avatar">
          <span className="persona-flag">{personaInfo.flag}</span>
          {radio.radioState === 'transmitting' ? (
            <Mic className="persona-status-icon animate-bounce text-red-500" />
          ) : radio.radioState === 'processing' ? (
            <Loader2 className="persona-status-icon animate-spin text-amber-500" />
          ) : radio.radioState === 'speaking' ? (
            <Radio className="persona-status-icon animate-pulse text-emerald-500" />
          ) : (
            <Radio className="persona-status-icon text-cyan-400" />
          )}
        </div>

        <div className="voice-cockpit-persona-meta">
          <div className="persona-title-row">
            <span className="persona-name">{personaInfo.name}</span>
            <span className="persona-role-badge">{personaInfo.role}</span>
          </div>
          <span className="voice-cockpit-status-badge">{statusHeroText}</span>
        </div>
      </div>

      {/* Hero Waveform Canvas & Volume Level */}
      <div className="voice-cockpit-waveform-box">
        <RadioWaveformCanvas
          radioState={radio.isRadioEnabled ? radio.radioState : 'idle'}
          width={260}
          height={36}
          barCount={24}
          gap={4}
          className="voice-cockpit-waveform-canvas"
          testId="voice-cockpit-waveform"
          fallbackClassName="voice-cockpit-eq-fallback"
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="voice-cockpit-controls">
        <button
          type="button"
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          className="voice-cockpit-btn"
          title={volume > 0 ? t('ai_engineer.radio.mute') : t('ai_engineer.radio.unmute')}
          data-testid="voice-cockpit-mute-btn"
        >
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} style={{ color: '#ef4444' }} />}
        </button>

        <button
          type="button"
          onClick={() => radio.setIsRadioEnabled(!radio.isRadioEnabled)}
          className={`voice-cockpit-btn ${!radio.isRadioEnabled ? 'btn-power-off' : ''}`}
          title={radio.isRadioEnabled ? t('live.cockpit.turnRadioOff') : t('live.cockpit.turnRadioOn')}
          data-testid="voice-cockpit-power-btn"
        >
          <Power size={16} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="voice-cockpit-btn"
          title={t('live.cockpit.settings')}
          data-testid="voice-cockpit-settings-btn"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};
