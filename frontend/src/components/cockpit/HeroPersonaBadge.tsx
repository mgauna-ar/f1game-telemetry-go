import React from 'react';
import { Volume2, VolumeX, Power, Settings } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { RadioWaveformCanvas } from '../common/RadioWaveformCanvas';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/Button';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';
import { getRadioVisualState } from '../../utils/radioVisuals';
import { RadioStateIcon } from './RadioStateIcon';
import styles from './HeroPersonaBadge.module.css';

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
  const state = getRadioVisualState(radio);

  return (
    <div className={styles.header}>
      {/* Who is on the radio, and what the radio is doing */}
      <div className={styles.persona}>
        <div className={styles.avatar}>
          <span className={styles.flag}>{personaInfo.flag}</span>
          <span className={styles.stateIcon}>
            <RadioStateIcon state={state} size={14} />
          </span>
        </div>

        <div className={styles.meta}>
          <div className={styles.titleRow}>
            <h2 className={styles.name}>{personaInfo.name}</h2>
            <Badge tone="accent" size="xs" square uppercase>
              {personaInfo.role}
            </Badge>
          </div>
          <span className={styles.status}>{statusHeroText}</span>
        </div>
      </div>

      <div className={styles.waveformBox}>
        <RadioWaveformCanvas
          radioState={radio.isRadioEnabled ? radio.radioState : 'idle'}
          width={260}
          height={36}
          barCount={24}
          gap={4}
          className={styles.waveform}
          testId="voice-cockpit-waveform"
          fallbackClassName={styles.waveformFallback}
        />
      </div>

      <div className={styles.controls}>
        <IconButton
          variant="secondary"
          label={volume > 0 ? t('ai_engineer.radio.mute') : t('ai_engineer.radio.unmute')}
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          data-testid="voice-cockpit-mute-btn"
        >
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} className={styles.muted} />}
        </IconButton>
        <IconButton
          variant="secondary"
          className={radio.isRadioEnabled ? undefined : styles.powerOff}
          label={radio.isRadioEnabled ? t('live.cockpit.turnRadioOff') : t('live.cockpit.turnRadioOn')}
          onClick={() => radio.setIsRadioEnabled(!radio.isRadioEnabled)}
          data-testid="voice-cockpit-power-btn"
        >
          <Power size={16} />
        </IconButton>
        <IconButton
          variant="secondary"
          label={t('live.cockpit.settings')}
          onClick={onOpenSettings}
          data-testid="voice-cockpit-settings-btn"
        >
          <Settings size={16} />
        </IconButton>
      </div>
    </div>
  );
};
