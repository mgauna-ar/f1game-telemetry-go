import React from 'react';
import { Radio, WifiOff, Activity, CheckCircle2, Info } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface WaitingForDataProps {
  connected: boolean;
}

export const WaitingForData: React.FC<WaitingForDataProps> = ({ connected }) => {
  const { t } = useI18n();

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
              <span className={`status-dot ${connected ? 'status-live' : 'status-waiting'}`} />
              {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
            </span>
            <span className="waiting-port-pill mono">
              {t('live.udpPort')} <strong>20777</strong>
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
              <li>
                <span className="chk-label">{t('live.udpBroadcast')}:</span>
                <span className="chk-val">{t('live.udpBroadcastVal')}</span>
              </li>
              <li>
                <span className="chk-label">{t('live.udpPort')}:</span>
                <span className="chk-val highlight-blue">20777</span>
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
          </div>
        </div>


        {/* Live Listening Footer */}
        <div className="waiting-footer-info">
          <div className="footer-listening-indicator">
            <Activity size={14} className="pulse-indicator" />
            <span className="mono">{t('live.listeningFooter')}</span>
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

