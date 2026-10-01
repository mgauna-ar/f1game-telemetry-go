import React from 'react';
import { Radio, WifiOff, Activity, Gauge } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { ConnectionStatusPills } from '../common/ConnectionStatusPills';
import styles from './StandbyStatusCards.module.css';

export interface StandbyStatusCardsProps {
  connected: boolean;
  personaName: string;
  effectiveLanguage: string;
  /** How to talk to the pit wall, e.g. "Hold Space or mapped wheel button to talk". */
  pttHint: string;
}

interface StandbyCardProps {
  icon: React.ReactNode;
  tone?: 'cyan' | 'amber' | 'purple';
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  highlight?: boolean;
}

/** One status card: an icon, what it is, its current value and a hint. */
const StandbyCard: React.FC<StandbyCardProps> = ({ icon, tone = 'cyan', label, value, hint, highlight }) => (
  <li className={styles.card} data-tone={tone}>
    <span className={styles.cardIcon} aria-hidden="true">
      {icon}
    </span>
    <dl className={styles.cardText}>
      <dt className={styles.cardLabel}>{label}</dt>
      <dd className={styles.cardValue} data-highlight={highlight}>
        {value}
      </dd>
      <dd className={styles.cardHint}>{hint}</dd>
    </dl>
  </li>
);

export const StandbyStatusCards: React.FC<StandbyStatusCardsProps> = ({
  connected,
  personaName,
  effectiveLanguage,
  pttHint,
}) => {
  const { t } = useI18n();
  const endpoint = useTelemetryEndpointStore((s) => s.endpoint);
  const lanIp = endpoint.lan_ips.find((ip) => ip !== endpoint.local_ip);

  return (
    <div className={styles.panel} data-testid="voice-cockpit-standby-panel">
      <div className={styles.header}>
        <div className={styles.radar} data-connected={connected} aria-hidden="true">
          {connected ? <Radio size={26} /> : <WifiOff size={26} />}
        </div>
        <div className={styles.titles}>
          <ConnectionStatusPills connected={connected} />
          <h3 className={styles.title}>{connected ? t('live.waitingForLive') : t('live.connectingToBridge')}</h3>
          <p className={styles.subtitle}>
            {connected ? t('live.telemetryListening') : t('live.establishingWebSocket')}
          </p>
        </div>
      </div>

      <ul className={styles.grid}>
        <StandbyCard
          icon={<Radio size={18} />}
          label={t('live.cockpit.title')}
          value={`${personaName} • ${effectiveLanguage === 'es' ? 'ES' : 'EN'}`}
          highlight
          hint={pttHint}
        />
        <StandbyCard
          icon={<Activity size={18} />}
          tone="amber"
          label={t('live.udpBridge')}
          value={connected ? t('live.bridgeListening', { addr: endpoint.udp_addr }) : t('live.bridgeConnecting')}
          hint={t('live.dashboardAutoOpenTip')}
        />
        <StandbyCard
          icon={<Gauge size={18} />}
          tone="purple"
          label={t('live.inGameTelemetrySettings')}
          value={t('live.udpSettingsSummary', { port: endpoint.udp_port })}
          hint={
            lanIp
              ? t('live.ipSummary', { local: endpoint.local_ip, lan: lanIp })
              : t('live.ipSummaryLocalOnly', { local: endpoint.local_ip })
          }
        />
      </ul>
    </div>
  );
};
