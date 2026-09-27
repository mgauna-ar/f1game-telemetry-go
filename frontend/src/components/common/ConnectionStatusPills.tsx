import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { Badge } from '../ui/Badge';
import { cx } from '../ui/cx';
import styles from './ConnectionStatusPills.module.css';

export interface ConnectionStatusPillsProps {
  /** Backend WebSocket reachable (not the same as live data arriving). */
  connected: boolean;
  centered?: boolean;
}

/** "Backend connected" and the UDP port, shown while the dashboard waits for the game. */
export const ConnectionStatusPills: React.FC<ConnectionStatusPillsProps> = ({ connected, centered = false }) => {
  const { t } = useI18n();
  const udpPort = useTelemetryEndpointStore((s) => s.endpoint.udp_port);

  return (
    <div className={cx(styles.row, centered && styles.centered)}>
      <Badge
        tone={connected ? 'success' : 'warning'}
        size="md"
        icon={<span className={styles.dot} data-connected={connected} aria-hidden="true" />}
      >
        {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
      </Badge>
      <Badge size="md" uppercase>
        {t('live.udpPort')}: <span className={styles.port}>{udpPort}</span>
      </Badge>
    </div>
  );
};
