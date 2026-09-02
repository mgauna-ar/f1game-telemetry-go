import React from 'react';
import { Radio, WifiOff, Activity, Gauge } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

export interface StandbyStatusCardsProps {
  connected: boolean;
  personaName: string;
  effectiveLanguage: string;
  mappedKey: string;
}

export const StandbyStatusCards: React.FC<StandbyStatusCardsProps> = ({
  connected,
  personaName,
  effectiveLanguage,
  mappedKey,
}) => {
  const { t } = useI18n();

  return (
    <div className="voice-cockpit-standby-panel" data-testid="voice-cockpit-standby-panel">
      <div className="standby-panel-header">
        <div className="standby-radar-mini">
          {connected ? (
            <Radio size={26} className="radar-icon-pulse text-cyan-400" />
          ) : (
            <WifiOff size={26} className="text-amber-400" />
          )}
        </div>
        <div className="standby-panel-titles">
          <div className="standby-badge-row">
            <span className={`waiting-status-pill ${connected ? 'pill-connected' : 'pill-reconnecting'}`}>
              <span className={`status-dot ${connected ? 'status-live' : 'status-waiting'}`} />
              {connected ? t('live.backendConnected') : t('live.connectingToBackend')}
            </span>
            <span className="waiting-port-pill mono">
              {t('live.udpPort')} <strong>20777</strong>
            </span>
          </div>
          <h3 className="standby-title">
            {connected ? t('live.waitingForLive') : t('live.connectingToBridge')}
          </h3>
          <p className="standby-subtitle">
            {connected ? t('live.telemetryListening') : t('live.establishingWebSocket')}
          </p>
        </div>
      </div>

      <div className="voice-cockpit-standby-grid">
        <div className="standby-status-card">
          <div className="standby-card-icon text-cyan-400">
            <Radio size={18} />
          </div>
          <div className="standby-card-info">
            <span className="standby-card-label">{t('live.cockpit.title')}</span>
            <span className="standby-card-val text-emerald-400 mono">
              {personaName} • {effectiveLanguage === 'es' ? 'ES' : 'EN'}
            </span>
            <span className="standby-card-hint">
              {t('ai_engineer.radio.pttHint', { key: mappedKey })}
            </span>
          </div>
        </div>

        <div className="standby-status-card">
          <div className="standby-card-icon text-amber-400">
            <Activity size={18} className="pulse-indicator" />
          </div>
          <div className="standby-card-info">
            <span className="standby-card-label">UDP TELEMETRY BRIDGE</span>
            <span className="standby-card-val mono text-cyan-300">
              {connected ? '0.0.0.0:20777 • LISTENING' : 'CONNECTING...'}
            </span>
            <span className="standby-card-hint">
              {t('live.dashboardAutoOpenTip')}
            </span>
          </div>
        </div>

        <div className="standby-status-card">
          <div className="standby-card-icon text-purple-400">
            <Gauge size={18} />
          </div>
          <div className="standby-card-info">
            <span className="standby-card-label">{t('live.inGameTelemetrySettings')}</span>
            <span className="standby-card-val mono text-slate-300">
              UDP: 20777 • 20Hz • 2025/2026
            </span>
            <span className="standby-card-hint">
              {t('live.udpBroadcastVal')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
