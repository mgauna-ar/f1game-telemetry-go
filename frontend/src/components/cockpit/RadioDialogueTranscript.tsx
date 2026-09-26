import React from 'react';
import { useI18n } from '../../context/I18nContext';
import type { UseRadioControllerReturn } from '../../hooks/useRadioController';
import type { SessionData } from '../../types/telemetry';
import { getPttHint } from '../../utils/pttHint';

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
  const pttHint = getPttHint(radio, t);

  return (
    <div className="voice-cockpit-dialogue-card">
      <div className="dialogue-header">
        <span className="dialogue-tag">{t('live.cockpit.recentTransmission')}</span>
        <div className="dialogue-ptt-badge">
          {pttHint.badge && <span className="key-chip">{pttHint.badge}</span>}
          <span className="ptt-label">{pttHint.text}</span>
          {!pttHint.badge && onSetUpPtt && (
            <button type="button" className="ptt-setup-link" onClick={onSetUpPtt}>
              {t('ai_engineer.radio.pttSetUp')} →
            </button>
          )}
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
