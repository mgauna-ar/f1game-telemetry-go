import React from 'react';
import { Radio, WifiOff, Activity, CheckCircle2, Info } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTelemetryEndpointStore } from '../store/useTelemetryEndpointStore';
import { CopyValueButton } from './common/CopyValueButton';

interface WaitingForDataProps {
  connected: boolean;
}

export const WaitingForData: React.FC<WaitingForDataProps> = ({ connected }) => {
  const { t } = useI18n();
  const endpoint = useTelemetryEndpointStore((s) => s.endpoint);
  // A listener bound to a single LAN address already shows it as the local address
  const lanIps = endpoint.lan_ips.filter((ip) => ip !== endpoint.local_ip);

  return (
    <div className="telemetry-waiting-container">
      <div className="glass-panel waiting-hero-card">
        {/* Animated Signal / Radar Header */}
        <div className="waiting-radar-wrapper">
          <div className="radar-ripple ring-1" />
          <div className="radar-ripple ring-2" />
          <div className="radar-ripple ring-3" />
          <div className={`radar-center-icon ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? (
              <Radio size={36} className="radar-icon-pulse" />
            ) : (
              <WifiOff size={36} />
            )}
          </div>
        </div>

        {/* Title and Connection State Badge */}
        <div className="waiting-title-section">
          <div className="waiting-status-badge-row">
            <span className={`waiting-status-pill ${connected ? 'pill-connected' : 'pill-reconnecting'}`}>
              <span className={`status-dot ${connected ? 'status-connected' : 'status-waiting'}`} />
              {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
            </span>
            <span className="waiting-port-pill mono">
              {t('live.udpPort')}: <strong>{endpoint.udp_port}</strong>
            </span>
          </div>

          <h2 className="waiting-hero-title">
            {connected ? t('live.waitingForLive') : t('live.connectingToBridge')}
          </h2>
          <p className="waiting-hero-subtitle">
            {connected
              ? t('live.telemetryListening')
              : t('live.establishingWebSocket')}
          </p>
        </div>

        {/* In-Game Telemetry Settings Checklist */}
        <div className="waiting-guide-grid">
          <div className="waiting-guide-card">
            <div className="guide-card-header">
              <CheckCircle2 size={16} className="guide-icon-accent" />
              <span>{t('live.inGameTelemetrySettings')}</span>
            </div>
            <ul className="guide-checklist mono">
              <li>
                <span className="chk-label">{t('live.udpTelemetry')}:</span>
                <span className="chk-val highlight-green">{t('live.on')}</span>
              </li>
              <li className="guide-ip-row">
                <span className="chk-label">{t('live.udpIpAddress')}:</span>
                <span className="guide-ip-values">
                  <span className="guide-ip-option">
                    <span className="guide-ip-hint">{t('live.ipThisPc')}</span>
                    <CopyValueButton value={endpoint.local_ip} />
                  </span>
                  {lanIps.map((ip) => (
                    <span key={ip} className="guide-ip-option">
                      <span className="guide-ip-hint">{t('live.ipOtherDevice')}</span>
                      <CopyValueButton value={ip} />
                    </span>
                  ))}
                </span>
              </li>
              <li>
                <span className="chk-label">{t('live.udpPort')}:</span>
                <span className="chk-val highlight-blue">{endpoint.udp_port}</span>
              </li>
              <li>
                <span className="chk-label">{t('live.udpSendRate')}:</span>
                <span className="chk-val">20Hz / 60Hz</span>
              </li>
              <li>
                <span className="chk-label">{t('live.udpFormat')}:</span>
                <span className="chk-val highlight-purple">2025 / 2026</span>
              </li>
            </ul>
            {lanIps.length > 0 && <p className="guide-broadcast-hint">{t('live.udpBroadcastHint')}</p>}
          </div>
        </div>


        {/* Live Listening Footer */}
        <div className="waiting-footer-info">
          <div className="footer-listening-indicator">
            <Activity size={14} className="pulse-indicator" />
            <span className="mono">{t('live.listeningFooter', { addr: endpoint.udp_addr })}</span>
          </div>
          <div className="footer-tip">
            <Info size={13} />
            <span>{t('live.dashboardAutoOpenTip')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

