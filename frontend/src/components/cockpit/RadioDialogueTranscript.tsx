import React from 'react';
import { useI18n } from '../../context/I18nContext';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';
import type { SessionData } from '../../types/telemetry';

export interface RadioDialogueTranscriptProps {
  radio: UseRadioControllerReturn;
  connected: boolean;
  session: SessionData | null;
}

export const RadioDialogueTranscript: React.FC<RadioDialogueTranscriptProps> = ({
  radio,
  connected,
  session,
}) => {
  const { t } = useI18n();

  return (
    <div className="voice-cockpit-dialogue-card">
      <div className="dialogue-header">
        <span className="dialogue-tag">{t('live.cockpit.recentTransmission')}</span>
        <div className="dialogue-ptt-badge">
          <span className="key-chip">{radio.mappedKey}</span>
          <span className="ptt-label">{t('ai_engineer.radio.pttHint', { key: radio.mappedKey })}</span>
        </div>
      </div>

      <div className="dialogue-body">
        {radio.radioState === 'speaking' && radio.lastResponse ? (
          <p className="dialogue-text active-speaking">
            "{radio.lastResponse}"
          </p>
        ) : radio.radioState === 'transmitting' && radio.lastTranscript ? (
          <p className="dialogue-text active-transmitting">
            "{radio.lastTranscript}..."
          </p>
        ) : radio.lastResponse ? (
          <p className="dialogue-text history">
            "{radio.lastResponse}"
          </p>
        ) : (
          <p className="dialogue-text placeholder">
            {connected && session
              ? t('live.cockpit.noRecentTransmissions')
              : t('live.cockpit.waitingSubtitle')}
          </p>
        )}
      </div>
    </div>
  );
};
