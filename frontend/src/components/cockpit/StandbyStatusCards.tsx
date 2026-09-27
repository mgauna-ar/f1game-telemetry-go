import React from 'react';
import { Radio, WifiOff, Activity, Gauge } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { ConnectionStatusPills } from '../common/ConnectionStatusPills';

export interface StandbyStatusCardsProps {
  connected: boolean;
  personaName: string;
  effectiveLanguage: string;
  /** How to talk to the pit wall, e.g. "Hold Space or mapped wheel button to talk". */
  pttHint: string;
}

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
            <ConnectionStatusPills connected={connected} />
          </div>
          <h3 className="standby-title">{connected ? t('live.waitingForLive') : t('live.connectingToBridge')}</h3>
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
            <span className="standby-card-hint">{pttHint}</span>
          </div>
        </div>

        <div className="standby-status-card">
          <div className="standby-card-icon text-amber-400">
            <Activity size={18} className="pulse-indicator" />
          </div>
          <div className="standby-card-info">
            <span className="standby-card-label">{t('live.udpBridge')}</span>
            <span className="standby-card-val mono text-cyan-300">
              {connected ? t('live.bridgeListening', { addr: endpoint.udp_addr }) : t('live.bridgeConnecting')}
            </span>
            <span className="standby-card-hint">{t('live.dashboardAutoOpenTip')}</span>
          </div>
        </div>

        <div className="standby-status-card">
          <div className="standby-card-icon text-purple-400">
            <Gauge size={18} />
          </div>
          <div className="standby-card-info">
            <span className="standby-card-label">{t('live.inGameTelemetrySettings')}</span>
            <span className="standby-card-val mono text-slate-300">
              {t('live.udpSettingsSummary', { port: endpoint.udp_port })}
            </span>
            <span className="standby-card-hint">
              {lanIp
                ? t('live.ipSummary', { local: endpoint.local_ip, lan: lanIp })
                : t('live.ipSummaryLocalOnly', { local: endpoint.local_ip })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
