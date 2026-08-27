import React, { useState } from 'react';
import {
  Radio,
  Mic,
  Volume2,
  VolumeX,
  Settings,
  Loader2,
  Power,
  ShieldAlert,
  Flag,
  Zap,
  Fuel,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Activity,
  WifiOff,
} from 'lucide-react';

import { useI18n } from '../context/I18nContext';
import {
  RADIO_PERSONAS,
  SAFETY_CAR_STATUS,
  DRIVER_STATUS,
  F1_FORMATS,
  ACTIVE_AERO_MODES,
  getTrackInfo,
  TRACK_NAMES,
  TYRE_COMPOUND_IDS,
} from '../constants/f1';
import { RadioSettingsPanel } from './RadioSettingsPanel';
import { TyreCompoundBadge } from './common/TyreCompoundBadge';
import { RadioWaveformCanvas } from './common/RadioWaveformCanvas';
import { TrackFlag } from './TrackFlag';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import type {
  SessionData,
  LapData,
  CarStatusData,
  CarDamageData,
  CarTelemetryData,
  CarTelemetry2Data,
} from '../types/telemetry';

import { useTelemetryStore } from '../store/useTelemetryStore';

export interface VoiceCockpitViewProps {
  radio: UseRadioControllerReturn;
  session?: SessionData | null;
  lap?: LapData | null;
  carStatus?: CarStatusData | null;
  carDamage?: CarDamageData | null;
  telemetry?: CarTelemetryData | null;
  telemetry2?: CarTelemetry2Data | null;
  packetFormat?: number | null;
  connected?: boolean;
}

export const VoiceCockpitView: React.FC<VoiceCockpitViewProps> = React.memo((props) => {
  const storeSession = useTelemetryStore((s) => s.session);
  const storePlayerIndex = useTelemetryStore((s) => s.playerCarIndex);
  const storeLap = useTelemetryStore((s) => s.allLaps[storePlayerIndex] || null);
  const storeCarStatus = useTelemetryStore((s) => s.allCarStatus[storePlayerIndex] || null);
  const storeCarDamage = useTelemetryStore((s) => s.allCarDamage[storePlayerIndex] || null);
  const storeTelemetry = useTelemetryStore((s) => s.allTelemetry[storePlayerIndex] || null);
  const storeTelemetry2 = useTelemetryStore((s) => s.allTelemetry2[storePlayerIndex] || null);
  const storePacketFormat = useTelemetryStore((s) => s.packetFormat);
  const storeConnected = useTelemetryStore((s) => s.connected);

  const radio = props.radio;
  const session = props.session !== undefined ? props.session : storeSession;
  const lap = props.lap !== undefined ? props.lap : storeLap;
  const carStatus = props.carStatus !== undefined ? props.carStatus : storeCarStatus;
  const carDamage = props.carDamage !== undefined ? props.carDamage : storeCarDamage;
  const telemetry = props.telemetry !== undefined ? props.telemetry : storeTelemetry;
  const telemetry2 = props.telemetry2 !== undefined ? props.telemetry2 : storeTelemetry2;
  const packetFormat = props.packetFormat !== undefined ? props.packetFormat : storePacketFormat;
  const connected = props.connected !== undefined ? props.connected : storeConnected;

  const { t } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const effectiveFormat = packetFormat || session?.PacketFormat;
  const is2026 = effectiveFormat === F1_FORMATS.FORMAT_2026;

  const trackInfo = session?.TrackId !== undefined ? getTrackInfo(session.TrackId) : null;
  const trackName = trackInfo?.name || (session?.TrackId !== undefined ? (TRACK_NAMES[session.TrackId] || `Track #${session.TrackId}`) : 'F1 Circuit');

  const getPersonaLabel = () => {
    const langFlag = radio.effectiveLanguage === 'es' ? '🇦🇷' : '🇬🇧';
    switch (radio.persona) {
      case RADIO_PERSONAS.COLAPINTO:
        return { name: 'Franco Colapinto', flag: langFlag, role: 'Race Engineer' };
      case RADIO_PERSONAS.CUSTOM:
        return { name: t('ai_engineer.personas.custom.name'), flag: '⚙️', role: 'Custom Pit Wall' };
      case RADIO_PERSONAS.BONO:
      default:
        return { name: 'Peter "Bono" Bonnington', flag: langFlag, role: 'Senior Race Engineer' };
    }
  };

  const personaInfo = getPersonaLabel();

  // Safety Car / Flag banner determination
  const renderSafetyCarBanner = () => {
    if (!session) return null;

    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.FULL) {
      return (
        <div className="voice-cockpit-flag-banner sc-full">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span className="banner-text">SAFETY CAR DEPLOYED — DELTA POSITIVE</span>
        </div>
      );
    }
    if (session.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL) {
      return (
        <div className="voice-cockpit-flag-banner sc-vsc">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span className="banner-text">VIRTUAL SAFETY CAR — MAINTAIN DELTA</span>
        </div>
      );
    }
    if (session.NumRedFlagPeriods && session.NumRedFlagPeriods > 0) {
      return (
        <div className="voice-cockpit-flag-banner sc-red">
          <Flag className="w-5 h-5 animate-pulse" />
          <span className="banner-text">RED FLAG — RETURN TO PIT LANE</span>
        </div>
      );
    }
    return null;
  };

  // Driver run status text
  const getRunStatusLabel = () => {
    switch (lap?.DriverStatus) {
      case DRIVER_STATUS.FLYING_LAP:
        return t('live.statusHotlap');
      case DRIVER_STATUS.OUT_LAP:
        return t('live.statusOutlap');
      case DRIVER_STATUS.IN_LAP:
        return t('live.statusPit');
      case DRIVER_STATUS.IN_GARAGE:
        return t('live.statusGarage');
      default:
        return 'ON TRACK';
    }
  };

  // Tyre wear percentages & temperatures
  const tyresWear = carDamage?.TyresWear || [0, 0, 0, 0];
  const roundedWears = tyresWear.map((w: number) => Math.round(w || 0));
  const peakWear = Math.max(...roundedWears);
  const surfTemps = telemetry?.TyresSurfaceTemperature || [0, 0, 0, 0];

  const getTyreWearClass = (wear: number) => {
    if (wear >= 75) return 'wear-critical';
    if (wear >= 40) return 'wear-warning';
    return 'wear-nominal';
  };

  // ERS Energy
  const storeEnergy = carStatus?.ERSStoreEnergy !== undefined ? carStatus.ERSStoreEnergy : (carStatus as any)?.ErsStoreEnergy;
  const ersPct = storeEnergy !== undefined ? Math.min(100, Math.max(0, Math.round((storeEnergy / 4000000) * 100))) : null;

  // Fuel remaining delta laps
  const fuelDelta = carStatus && typeof carStatus.FuelRemainingLaps === 'number' ? carStatus.FuelRemainingLaps : null;

  // Aero damage
  const flWing = Math.round(carDamage?.FrontLeftWingDamage || 0);
  const frWing = Math.round(carDamage?.FrontRightWingDamage || 0);
  const floorDamage = Math.round((carDamage?.FloorDamage || 0) + (carDamage?.DiffuserDamage || 0));
  const hasAeroDamage = flWing > 0 || frWing > 0 || floorDamage > 0;

  // Active Aero / Boost (2026)
  const activeAeroMode = telemetry2?.ActiveAeroMode;
  const boostActive = telemetry2 && typeof telemetry2.OvertakeActive === 'number' && telemetry2.OvertakeActive > 0;

  // Radio active status pill
  let stateClass = 'state-idle';
  let statusHeroText = t('live.cockpit.standby');

  if (!radio.isRadioEnabled) {
    stateClass = 'state-off';
    statusHeroText = 'RADIO POWER OFF';
  } else if (radio.radioState === 'transmitting') {
    stateClass = 'state-transmitting';
    statusHeroText = t('live.cockpit.transmitting');
  } else if (radio.radioState === 'processing') {
    stateClass = 'state-processing';
    statusHeroText = t('live.cockpit.processing');
  } else if (radio.radioState === 'speaking') {
    stateClass = 'state-speaking';
    statusHeroText = t('live.cockpit.speaking', { name: personaInfo.name.toUpperCase() });
  }

  return (
    <div className="voice-cockpit-container" data-testid="voice-cockpit-container">
      {/* Safety Car / Flag Alert Banner */}
      {renderSafetyCarBanner()}

      {/* Hero Voice Engineer Card */}
      <div className={`voice-cockpit-hero-card ${stateClass}`}>
        <div className="voice-cockpit-hero-header">
          {/* Persona Avatar & Info */}
          <div className="voice-cockpit-persona-box">
            <div className="voice-cockpit-avatar">
              <span className="persona-flag">{personaInfo.flag}</span>
              {radio.radioState === 'transmitting' ? (
                <Mic className="persona-status-icon animate-bounce text-red-500" />
              ) : radio.radioState === 'processing' ? (
                <Loader2 className="persona-status-icon animate-spin text-amber-500" />
              ) : radio.radioState === 'speaking' ? (
                <Radio className="persona-status-icon animate-pulse text-emerald-500" />
              ) : (
                <Radio className="persona-status-icon text-cyan-400" />
              )}
            </div>

            <div className="voice-cockpit-persona-meta">
              <div className="persona-title-row">
                <span className="persona-name">{personaInfo.name}</span>
                <span className="persona-role-badge">{personaInfo.role}</span>
              </div>
              <span className="voice-cockpit-status-badge">{statusHeroText}</span>
            </div>
          </div>

          {/* Hero Waveform Canvas & Volume Level */}
          <div className="voice-cockpit-waveform-box">
            <RadioWaveformCanvas
              radioState={radio.isRadioEnabled ? radio.radioState : 'idle'}
              width={260}
              height={36}
              barCount={24}
              gap={4}
              className="voice-cockpit-waveform-canvas"
              testId="voice-cockpit-waveform"
              fallbackClassName="voice-cockpit-eq-fallback"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="voice-cockpit-controls">
            <button
              type="button"
              onClick={() => radio.setVolume(radio.volume > 0 ? 0 : 0.8)}
              className="voice-cockpit-btn"
              title={radio.volume > 0 ? t('ai_engineer.radio.mute') : t('ai_engineer.radio.unmute')}
              data-testid="voice-cockpit-mute-btn"
            >
              {radio.volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} style={{ color: '#ef4444' }} />}
            </button>

            <button
              type="button"
              onClick={() => radio.setIsRadioEnabled(!radio.isRadioEnabled)}
              className={`voice-cockpit-btn ${!radio.isRadioEnabled ? 'btn-power-off' : ''}`}
              title={radio.isRadioEnabled ? t('live.cockpit.turnRadioOff') : t('live.cockpit.turnRadioOn')}
              data-testid="voice-cockpit-power-btn"
            >
              <Power size={16} />
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="voice-cockpit-btn"
              title={t('live.cockpit.settings')}
              data-testid="voice-cockpit-settings-btn"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Real-time Transmission / Dialogue Transcript */}
        <div className="voice-cockpit-dialogue-card">
          <div className="dialogue-header">
            <span className="dialogue-tag">{t('live.cockpit.recentTransmission')}</span>
            <div className="dialogue-ptt-badge">
              <span className="key-chip">{radio.mappedKey}</span>
              <span className="ptt-label">{t('ai_engineer.radio.pttHint', { key: radio.mappedKey })}</span>
            </div>
          </div>

          <div className="dialogue-body">
            {radio.radioState === 'speaking' && radio.lastResponse ? (
              <p className="dialogue-text active-speaking">
                "{radio.lastResponse}"
              </p>
            ) : radio.radioState === 'transmitting' && radio.lastTranscript ? (
              <p className="dialogue-text active-transmitting">
                "{radio.lastTranscript}..."
              </p>
            ) : radio.lastResponse ? (
              <p className="dialogue-text history">
                "{radio.lastResponse}"
              </p>
            ) : (
              <p className="dialogue-text placeholder">
                {connected && session
                  ? t('live.cockpit.noRecentTransmissions')
                  : t('live.cockpit.waitingSubtitle')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Standby Telemetry Panel when waiting for session data */}
      {!session || !connected ? (
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
                  {personaInfo.name} • {radio.effectiveLanguage === 'es' ? 'ES' : 'EN'}
                </span>
                <span className="standby-card-hint">
                  {t('ai_engineer.radio.pttHint', { key: radio.mappedKey })}
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
      ) : (
        /* Minimalist Vitals Telemetry Grid (Mounted when session is active) */
        <div className="voice-cockpit-vitals-grid" data-testid="voice-cockpit-vitals-grid">
          {/* Card 1: Position & Lap Status */}
          <div className="voice-cockpit-card">
            <div className="card-header">
              <span className="card-title">{t('live.cockpit.position')} & {t('live.cockpit.lap')}</span>
              <span className="run-status-chip">{getRunStatusLabel()}</span>
            </div>
            <div className="card-content position-row">
              <div className="big-stat">
                <span className="stat-p">P</span>
                <span className="stat-val mono">{lap?.CarPosition || 1}</span>
              </div>
              <div className="lap-meta">
                <div className="stat-sub-row">
                  <span className="meta-label">{t('live.cockpit.lap')}:</span>
                  <span className="meta-val mono">
                    {lap?.CurrentLapNum || 1} / {session?.TotalLaps || '--'}
                  </span>
                </div>
                <div className="stat-sub-row">
                  <span className="meta-label">{trackName}</span>
                  <TrackFlag track={session?.TrackId ?? trackName} width={18} height={12} />
                </div>
                {lap && (lap.Penalties || lap.CornerCuttingWarnings) ? (
                  <div className="warnings-badge">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span>
                      {lap.CornerCuttingWarnings ?? 0}/3 warnings
                      {lap.Penalties ? ` • +${lap.Penalties}s` : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Card 2: Tyres & Thermal Vitals */}
          <div className="voice-cockpit-card">
            <div className="card-header">
              <span className="card-title">{t('live.cockpit.tyreWear')}</span>
              <div className="tyre-badge-row">
                <TyreCompoundBadge
                  compound={
                    carStatus?.ActualTyreCompound !== undefined
                      ? String(carStatus.ActualTyreCompound)
                      : String(TYRE_COMPOUND_IDS.SOFT)
                  }
                />
                <span className="mono text-xs text-slate-400">{carStatus?.TyresAgeLaps || 0} L</span>
              </div>
            </div>
            <div className="card-content">
              <div className="tyre-grid-2x2">
                <div className={`tyre-corner ${getTyreWearClass(roundedWears[0])}`}>
                  <div className="corner-label">FL</div>
                  <div className="corner-wear mono">{roundedWears[0]}%</div>
                  <div className="corner-temp mono">{Math.round(surfTemps[0] || 0)}°C</div>
                </div>
                <div className={`tyre-corner ${getTyreWearClass(roundedWears[1])}`}>
                  <div className="corner-label">FR</div>
                  <div className="corner-wear mono">{roundedWears[1]}%</div>
                  <div className="corner-temp mono">{Math.round(surfTemps[1] || 0)}°C</div>
                </div>
                <div className={`tyre-corner ${getTyreWearClass(roundedWears[2])}`}>
                  <div className="corner-label">RL</div>
                  <div className="corner-wear mono">{roundedWears[2]}%</div>
                  <div className="corner-temp mono">{Math.round(surfTemps[2] || 0)}°C</div>
                </div>
                <div className={`tyre-corner ${getTyreWearClass(roundedWears[3])}`}>
                  <div className="corner-label">RR</div>
                  <div className="corner-wear mono">{roundedWears[3]}%</div>
                  <div className="corner-temp mono">{Math.round(surfTemps[3] || 0)}°C</div>
                </div>
              </div>
              <div className="peak-wear-indicator">
                <span>{t('live.cockpit.peakWear', { percent: peakWear })}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Powertrain, ERS & Fuel Delta */}
          <div className="voice-cockpit-card">
            <div className="card-header">
              <span className="card-title">POWERTRAIN & STRATEGY</span>
              {is2026 && activeAeroMode !== undefined && (
                <span className={`aero-badge ${activeAeroMode === ACTIVE_AERO_MODES.STRAIGHT ? 'straight' : 'corner'}`}>
                  {activeAeroMode === ACTIVE_AERO_MODES.STRAIGHT ? t('live.activeAeroStraight') : t('live.activeAeroCorner')}
                </span>
              )}
            </div>
            <div className="card-content powertrain-content">
              {/* ERS Store */}
              <div className="vitals-metric-row">
                <div className="metric-label-box">
                  <Zap size={14} className="text-cyan-400" />
                  <span>{t('live.cockpit.ersBattery')}</span>
                </div>
                <div className="metric-value-box">
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill ers-fill"
                      style={{ width: `${ersPct ?? 0}%` }}
                    />
                  </div>
                  <span className="metric-num mono">{ersPct !== null ? `${ersPct}%` : '--'}</span>
                </div>
              </div>

              {/* Fuel Delta */}
              <div className="vitals-metric-row">
                <div className="metric-label-box">
                  <Fuel size={14} className="text-amber-400" />
                  <span>{t('live.cockpit.fuelDelta')}</span>
                </div>
                <div className="metric-value-box">
                  <span
                    className={`metric-num mono ${
                      fuelDelta !== null && fuelDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fuelDelta !== null ? `${fuelDelta >= 0 ? '+' : ''}${fuelDelta.toFixed(1)} Laps` : '--'}
                  </span>
                </div>
              </div>

              {/* 2026 Boost / Engine Temperature */}
              <div className="vitals-metric-row">
                <div className="metric-label-box">
                  <Gauge size={14} className="text-slate-400" />
                  <span>Engine / Coolant</span>
                </div>
                <div className="metric-value-box">
                  <span className="metric-num mono text-slate-300">
                    {telemetry?.EngineTemperature ? `${Math.round(telemetry.EngineTemperature)}°C` : '--°C'}
                  </span>
                  {boostActive && <span className="boost-pill">{t('live.boostActive')}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Damage & Vehicle Systems */}
          <div className="voice-cockpit-card">
            <div className="card-header">
              <span className="card-title">{t('live.cockpit.aeroDamage')}</span>
              {!hasAeroDamage ? (
                <span className="status-nominal-badge">
                  <CheckCircle2 size={12} /> NOMINAL
                </span>
              ) : (
                <span className="status-damaged-badge">
                  <AlertTriangle size={12} /> DAMAGE
                </span>
              )}
            </div>
            <div className="card-content damage-content">
              {hasAeroDamage ? (
                <div className="damage-details-grid">
                  <div className="damage-item">
                    <span className="dmg-label">{t('live.cockpit.frontWing')} (L/R)</span>
                    <span className="dmg-val mono text-red-400">{flWing}% / {frWing}%</span>
                  </div>
                  <div className="damage-item">
                    <span className="dmg-label">{t('live.cockpit.floorDiffuser')}</span>
                    <span className="dmg-val mono text-red-400">{floorDamage}%</span>
                  </div>
                </div>
              ) : (
                <div className="nominal-state-box">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <span className="nominal-text">Aero downforce & bodywork at 100% efficiency</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Settings Modal */}
      <RadioSettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        radio={radio}
      />
    </div>
  );
});

VoiceCockpitView.displayName = 'VoiceCockpitView';

