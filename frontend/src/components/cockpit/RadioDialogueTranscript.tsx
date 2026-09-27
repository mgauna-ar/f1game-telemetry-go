import React from 'react';
import { useI18n } from '../../context/I18nContext';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';
import type { SessionData } from '../../types/telemetry';
import { PttHint } from './PttHint';
import styles from './RadioDialogueTranscript.module.css';

export interface RadioDialogueTranscriptProps {
  radio: UseRadioControllerReturn;
  connected: boolean;
  session: SessionData | null;
  /** Opens the radio settings where a push-to-talk button can be set up. */
  onSetUpPtt?: () => void;
}

export const RadioDialogueTranscript: React.FC<RadioDialogueTranscriptProps> = ({
  radio,
  connected,
  session,
  onSetUpPtt,
}) => {
  const { t } = useI18n();

  // What is being said now, else the last call from the pit wall, else a placeholder
  const line =
    radio.radioState === 'speaking' && radio.lastResponse
      ? { tone: 'speaking', text: `"${radio.lastResponse}"` }
      : radio.radioState === 'transmitting' && radio.lastTranscript
        ? { tone: 'transmitting', text: `"${radio.lastTranscript}..."` }
        : radio.lastResponse
          ? { tone: undefined, text: `"${radio.lastResponse}"` }
          : {
              tone: 'placeholder',
              text: connected && session ? t('live.cockpit.noRecentTransmissions') : t('live.cockpit.waitingSubtitle'),
            };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.tag}>{t('live.cockpit.recentTransmission')}</h3>
        <PttHint controls={radio} onSetUp={onSetUpPtt} className={styles.ptt} />
      </div>

      <div className={styles.body}>
        <p className={styles.text} data-tone={line.tone}>
          {line.text}
        </p>
      </div>
    </div>
  );
};
