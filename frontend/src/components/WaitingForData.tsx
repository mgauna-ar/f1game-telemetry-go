import React from 'react';
import { Radio, WifiOff, Activity, CheckCircle2, Info } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { otherDeviceIps, useTelemetryEndpointStore } from '../store/useTelemetryEndpointStore';
import { ConnectionStatusPills } from './common/ConnectionStatusPills';
import { CopyValueButton } from './common/CopyValueButton';
import styles from './WaitingForData.module.css';

interface WaitingForDataProps {
  connected: boolean;
}

interface CheckItemProps {
  label: string;
  children: React.ReactNode;
  highlight?: 'green' | 'blue' | 'purple';
  alignTop?: boolean;
}

/** One setting of the in-game checklist: its name and the value to set. */
const CheckItem: React.FC<CheckItemProps> = ({ label, children, highlight, alignTop }) => (
  <div className={styles.checkItem} data-align={alignTop ? 'top' : undefined}>
    <dt className={styles.checkLabel}>{label}:</dt>
    <dd className={styles.checkValue} data-highlight={highlight}>
      {children}
    </dd>
  </div>
);

export const WaitingForData: React.FC<WaitingForDataProps> = ({ connected }) => {
  const { t } = useI18n();
  const endpoint = useTelemetryEndpointStore((s) => s.endpoint);
  const lanIps = otherDeviceIps(endpoint);
  const guideTitleId = React.useId();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Signal radar */}
        <div className={styles.radar} aria-hidden="true">
          <div className={styles.ripple} />
          <div className={styles.ripple} />
          <div className={styles.ripple} />
          <div className={styles.signal} data-connected={connected}>
            {connected ? <Radio size={36} /> : <WifiOff size={36} />}
          </div>
        </div>

        <div className={styles.titleSection}>
          <div className={styles.pills}>
            <ConnectionStatusPills connected={connected} centered />
          </div>
          <h2 className={styles.title}>{connected ? t('live.waitingForLive') : t('live.connectingToBridge')}</h2>
          <p className={styles.subtitle}>
            {connected ? t('live.telemetryListening') : t('live.establishingWebSocket')}
          </p>
        </div>

        {/* In-game telemetry settings checklist */}
        <section className={styles.guide} aria-labelledby={guideTitleId}>
          <h3 id={guideTitleId} className={styles.guideHeader}>
            <CheckCircle2 size={16} className={styles.guideIcon} aria-hidden="true" />
            {t('live.inGameTelemetrySettings')}
          </h3>
          <dl className={styles.checklist}>
            <CheckItem label={t('live.udpTelemetry')} highlight="green">
              {t('live.on')}
            </CheckItem>
            <CheckItem label={t('live.udpIpAddress')} alignTop>
              <span className={styles.ipValues}>
                <span className={styles.ipOption}>
                  <span className={styles.ipHint}>{t('live.ipThisPc')}</span>
                  <CopyValueButton value={endpoint.local_ip} />
                </span>
                {lanIps.map((ip) => (
                  <span key={ip} className={styles.ipOption}>
                    <span className={styles.ipHint}>{t('live.ipOtherDevice')}</span>
                    <CopyValueButton value={ip} />
                  </span>
                ))}
              </span>
            </CheckItem>
            <CheckItem label={t('live.udpPort')} highlight="blue">
              {endpoint.udp_port}
            </CheckItem>
            <CheckItem label={t('live.udpSendRate')}>20Hz / 60Hz</CheckItem>
            <CheckItem label={t('live.udpFormat')} highlight="purple">
              2025 / 2026
            </CheckItem>
          </dl>
          {lanIps.length > 0 && <p className={styles.broadcastHint}>{t('live.udpBroadcastHint')}</p>}
        </section>

        <div className={styles.footer}>
          <div className={styles.listening}>
            <Activity size={14} className={styles.listeningIcon} aria-hidden="true" />
            <span className="mono">{t('live.listeningFooter', { addr: endpoint.udp_addr })}</span>
          </div>
          <div className={styles.tip}>
            <Info size={14} aria-hidden="true" />
            <span>{t('live.dashboardAutoOpenTip')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
