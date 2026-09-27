import React, { useState } from 'react';
import { Volume2, VolumeX, Settings, Power } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { RadioSettingsPanel } from './RadioSettingsPanel';
import type { RadioSettingsTab } from './RadioSettingsPanel';
import { RadioWaveformCanvas } from './common/RadioWaveformCanvas';
import { PttHint } from './cockpit/PttHint';
import { RadioStateIcon } from './cockpit/RadioStateIcon';
import { getPersonaInfo, getRadioVisualState } from '../utils/radioVisuals';
import { Button, IconButton } from './ui/Button';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import styles from './LiveRadioHUD.module.css';

export interface LiveRadioHUDProps {
  radio: UseRadioControllerReturn;
}

export const LiveRadioHUD: React.FC<LiveRadioHUDProps> = ({ radio }) => {
  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<RadioSettingsTab | undefined>(undefined);
  const volume = useRadioSettingsStore((s) => s.volume);
  const setVolume = useRadioSettingsStore((s) => s.setVolume);

  const openSettings = (tab?: RadioSettingsTab) => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const state = getRadioVisualState(radio);
  const persona = getPersonaInfo(radio.persona, radio.effectiveLanguage, t);

  const statusText =
    state === 'transmitting'
      ? t('ai_engineer.radio.transmitting')
      : state === 'processing'
        ? t('ai_engineer.radio.processing')
        : state === 'speaking'
          ? t('ai_engineer.radio.speaking', { name: persona.shortName.toUpperCase() })
          : t('ai_engineer.radio.idle');

  const settingsButton = (
    <IconButton size="sm" label={t('ai_engineer.radio.settings')} onClick={() => openSettings()}>
      <Settings size={state === 'off' ? 14 : 16} />
    </IconButton>
  );

  return (
    <>
      <div className={styles.hud}>
        {state === 'off' ? (
          // Radio off: a compact pill to switch it back on
          <div className={styles.pill} data-state="off">
            <Button
              size="sm"
              className={styles.powerOn}
              icon={<Power size={14} aria-hidden="true" />}
              onClick={() => radio.setIsRadioEnabled(true)}
            >
              {t('ai_engineer.radio.turnOn')}
            </Button>
            {settingsButton}
          </div>
        ) : (
          <div className={styles.pill} data-state={state}>
            <div className={styles.icon}>
              <RadioStateIcon state={state} />
            </div>

            {/* Radio status, persona and what was last said (or how to talk) */}
            <div className={styles.info}>
              <div className={styles.statusRow}>
                <span className={styles.status}>{statusText}</span>
                <span className={styles.flag}>{persona.flag}</span>
              </div>

              <span className={styles.subtitle}>
                {state === 'speaking' && radio.lastResponse ? (
                  <span className={styles.quote} title={radio.lastResponse}>
                    "{radio.lastResponse}"
                  </span>
                ) : state === 'transmitting' && radio.lastTranscript ? (
                  <span className={styles.quote}>{radio.lastTranscript}...</span>
                ) : (
                  <PttHint controls={radio} onSetUp={() => openSettings('audio')} />
                )}
              </span>
            </div>

            {/* Live waveform while someone is talking */}
            {(state === 'transmitting' || state === 'speaking') && (
              <RadioWaveformCanvas
                radioState={state}
                width={36}
                height={18}
                barCount={6}
                gap={3}
                className={styles.waveform}
                testId="live-radio-waveform"
                fallbackTestId="live-radio-equalizer-fallback"
              />
            )}

            <div className={styles.actions}>
              <IconButton
                size="sm"
                label={volume > 0 ? t('ai_engineer.radio.mute') : t('ai_engineer.radio.unmute')}
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              >
                {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} className={styles.muted} />}
              </IconButton>
              <IconButton
                size="sm"
                className={styles.powerOff}
                label={t('ai_engineer.radio.turnOff')}
                onClick={() => radio.setIsRadioEnabled(false)}
              >
                <Power size={16} />
              </IconButton>
              {settingsButton}
            </div>
          </div>
        )}
      </div>

      <RadioSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        radio={radio}
        initialTab={settingsTab}
      />
    </>
  );
};
