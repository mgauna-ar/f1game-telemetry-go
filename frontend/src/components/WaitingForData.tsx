import React from 'react';
import { Radio, WifiOff, Activity, CheckCircle2, Terminal, Info, Zap } from 'lucide-react';

interface WaitingForDataProps {
  connected: boolean;
}

export const WaitingForData: React.FC<WaitingForDataProps> = ({ connected }) => {
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
              {connected ? 'BACKEND CONNECTED' : 'CONNECTING TO BACKEND...'}
            </span>
            <span className="waiting-port-pill mono">
              UDP PORT: <strong>20777</strong>
            </span>
          </div>

          <h2 className="waiting-hero-title">
            {connected ? 'Waiting for Live Session Telemetry' : 'Connecting to Telemetry Bridge'}
          </h2>
          <p className="waiting-hero-subtitle">
            {connected
              ? 'The telemetry server is listening. Launch EA Sports F1 2025/2026 or start a simulator to stream live track telemetry.'
              : 'Establishing WebSocket connection to the local telemetry daemon...'}
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
