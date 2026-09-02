import React from 'react';
import {
  Zap,
  Fuel,

  Gauge,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  DRIVER_STATUS,
  ACTIVE_AERO_MODES,
  TYRE_COMPOUND_IDS,
  MAX_ERS_STORE_ENERGY_J,
} from '../../constants/f1';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { TrackFlag } from '../TrackFlag';
import type {
  SessionData,
  LapData,
  CarStatusData,
  CarDamageData,
  CarTelemetryData,
  CarTelemetry2Data,
} from '../../types/telemetry';

export interface VitalTelemetryStripProps {
  session: SessionData | null;
  lap: LapData | null;
  carStatus: CarStatusData | null;
  carDamage: CarDamageData | null;
  telemetry: CarTelemetryData | null;
  telemetry2: CarTelemetry2Data | null;
  trackName: string;
  is2026: boolean;
}

export const VitalTelemetryStrip: React.FC<VitalTelemetryStripProps> = ({
  session,
  lap,
  carStatus,
  carDamage,
  telemetry,
  telemetry2,
  trackName,
  is2026,
}) => {
  const { t } = useI18n();

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

  // ERS Energy (Zero magic numbers: using MAX_ERS_STORE_ENERGY_J)
  const storeEnergy = carStatus?.ERSStoreEnergy;
  const ersPct =
    storeEnergy !== undefined
      ? Math.min(100, Math.max(0, Math.round((storeEnergy / MAX_ERS_STORE_ENERGY_J) * 100)))
      : null;

  // Fuel remaining delta laps
  const fuelDelta =
    carStatus && typeof carStatus.FuelRemainingLaps === 'number'
      ? carStatus.FuelRemainingLaps
      : null;

  // Aero damage
  const flWing = Math.round(carDamage?.FrontLeftWingDamage || 0);
  const frWing = Math.round(carDamage?.FrontRightWingDamage || 0);
  const floorDamage = Math.round((carDamage?.FloorDamage || 0) + (carDamage?.DiffuserDamage || 0));
  const hasAeroDamage = flWing > 0 || frWing > 0 || floorDamage > 0;

  // Active Aero / Boost (2026)
  const activeAeroMode = telemetry2?.ActiveAeroMode;
  const boostActive =
    telemetry2 && typeof telemetry2.OvertakeActive === 'number' && telemetry2.OvertakeActive > 0;

  return (
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
                  : carStatus?.VisualTyreCompound !== undefined
                  ? String(carStatus.VisualTyreCompound)
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
  );
};
