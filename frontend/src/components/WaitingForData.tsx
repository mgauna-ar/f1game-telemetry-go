import React from 'react';
import { Radio, Activity, CheckCircle2, Terminal, Info, Zap } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface WaitingForDataProps {
  connected: boolean;
}

export const WaitingForData: React.FC<WaitingForDataProps> = ({ connected }) => {
  const { t } = useI18n();

  return (
    <div className="waiting-for-data-container">
      <div className="waiting-card glass-panel">
        {/* Animated Radar Scanning Effect */}
        <div className="radar-spinner">
          <div className="radar-circle circle-1" />
          <div className="radar-circle circle-2" />
          <div className="radar-circle circle-3" />
          <div className="radar-sweep" />
          <Radio size={36} className="radar-center-icon" />
        </div>

        {/* Pulse Status Badges */}
        <div className="waiting-status-badges">
          <div className={`status-badge-chip ${connected ? 'chip-connected' : 'chip-connecting'}`}>
            <span className="pulse-dot" />
            <span>
              {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
            </span>
          </div>
          <div className="status-badge-chip chip-port">
            <Activity size={13} />
            <span>{t('live.udpPort')} <strong>20777</strong></span>
          </div>
        </div>

        {/* Title and Subtitle */}
        <div className="waiting-title-section">
          <h2 className="waiting-title">
            {connected
              ? t('live.waitingForLive')
              : t('live.connectingToBridge')}
          </h2>
          <p className="waiting-description">
            {connected
              ? t('live.telemetryListening')
              : t('live.establishingWebSocket')}
          </p>
        </div>

        {/* Quick Setup / Checklist Guide */}
        <div className="waiting-guide-grid">
          <div className="waiting-guide-card">
            <div className="guide-card-header">
              <CheckCircle2 size={16} className="guide-icon-accent" />
              <span>In-Game Telemetry Settings</span>
            </div>
            <ul className="guide-checklist mono">
              <li>
                <span className="chk-label">UDP Telemetry:</span>
                <span className="chk-val highlight-green">ON</span>
              </li>
              <li>
                <span className="chk-label">UDP Broadcast:</span>
                <span className="chk-val">ON (or IP: 127.0.0.1)</span>
              </li>
              <li>
                <span className="chk-label">UDP Port:</span>
                <span className="chk-val highlight-blue">20777</span>
              </li>
              <li>
                <span className="chk-label">UDP Send Rate:</span>
                <span className="chk-val">20Hz / 60Hz</span>
              </li>
              <li>
                <span className="chk-label">UDP Format:</span>
                <span className="chk-val highlight-purple">2025 / 2026</span>
              </li>
            </ul>
          </div>

          <div className="waiting-guide-card">
            <div className="guide-card-header">
              <Terminal size={16} className="guide-icon-accent" />
              <span>Packet Simulator Shortcut</span>
            </div>
            <p className="guide-desc">
              Want to preview the live telemetry dashboard without running the game? Run the built-in UDP telemetry simulator:
            </p>
            <div className="guide-code-snippet mono">
              <code>make simulate</code>
              <span className="guide-code-or">or</span>
              <code>simulate.bat</code>
            </div>
            <div className="guide-sub-note">
              <Zap size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span>Generates real-time 20Hz car motion, setup, tyre wear, and lap sector packets.</span>
            </div>
          </div>
        </div>

        {/* Live Listening Footer */}
        <div className="waiting-footer-info">
          <div className="footer-listening-indicator">
            <Activity size={14} className="pulse-indicator" />
            <span className="mono">LISTENING ON 0.0.0.0:20777 • AUTO-SYNC ACTIVE</span>
          </div>
          <div className="footer-tip">
            <Info size={13} />
            <span>Dashboard will automatically open the instant telemetry packets are detected.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
