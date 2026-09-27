import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { useLiveStatus } from '../../hooks/useLiveStatus';
import { LIVE_STATUS } from '../../constants/f1';
import type { LiveStatus } from '../../constants/f1';
import styles from './LiveStatusIndicator.module.css';

const STATUS_LABEL_KEYS: Record<LiveStatus, string> = {
  [LIVE_STATUS.OFFLINE]: 'live.reconnecting',
  [LIVE_STATUS.LISTENING]: 'live.statusListening',
  [LIVE_STATUS.LIVE]: 'live.liveStatus',
  [LIVE_STATUS.STALE]: 'live.statusStale',
};

/** Live feed state for the live header: reconnecting, listening, live, or no signal. */
export const LiveStatusIndicator: React.FC = () => {
  const { t } = useI18n();
  const status = useLiveStatus();

  return (
    <div
      className={styles.indicator}
      data-status={status}
      title={status === LIVE_STATUS.STALE ? t('live.statusStaleTitle') : undefined}
      data-testid="live-status-indicator"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={`mono ${styles.label}`}>{t(STATUS_LABEL_KEYS[status])}</span>
    </div>
  );
};
