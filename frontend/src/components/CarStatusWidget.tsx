import React from 'react';
import { Fuel, BatteryCharging, Zap, Disc } from 'lucide-react';
import type { CarStatusData } from '../hooks/useTelemetry';
import { TYRE_COMPOUNDS } from './LeaderboardTower';

interface CarStatusWidgetProps {
  carStatus: CarStatusData | null;
  driverName?: string;
}

const ERS_DEPLOY_MODES: Record<number, string> = {
  0: 'NONE',
  1: 'MEDIUM',
  2: 'HOTLAP',
  3: 'OVERTAKE',
};

export const CarStatusWidget: React.FC<CarStatusWidgetProps> = ({ carStatus, driverName }) => {
  const rawFuel = carStatus?.FuelInTank !== undefined ? Math.max(0, carStatus.FuelInTank) : null;
  const fuel = rawFuel !== null ? (rawFuel > 200 ? '200.0+' : rawFuel.toFixed(1)) : '--';
  const fuelCapacity = carStatus?.FuelCapacity && carStatus.FuelCapacity > 0 ? carStatus.FuelCapacity : 110.0;
  const fuelPercent = rawFuel !== null ? Math.min(100, Math.max(0, (rawFuel / fuelCapacity) * 100)) : 0;

  // F1 ERS Energy store max capacity is 4.0 MJ (4,000,000 Joules)
  const ersJoules = carStatus?.ERSStoreEnergy !== undefined ? carStatus.ERSStoreEnergy : 0;
  const ersPercent = Math.min(100, Math.max(0, (ersJoules / 4000000.0) * 100));
  const ersModeText = carStatus?.ERSDeployMode !== undefined ? (ERS_DEPLOY_MODES[carStatus.ERSDeployMode] || 'NONE') : 'NONE';

  const tyre = carStatus?.VisualTyreCompound ? TYRE_COMPOUNDS[carStatus.VisualTyreCompound] : null;

  return (
    <div className="glass-panel car-status-widget">
      <div className="status-widget-header">
        <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="var(--accent-primary)" />
          Car Status & Pit Wall Telemetry
        </h3>
        {driverName && (
          <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, background: 'rgba(51, 255, 204, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(51, 255, 204, 0.3)' }}>
            SELECTED: {driverName}
          </span>
        )}
      </div>

      <div className="status-grid">
        {/* ERS Battery Panel */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BatteryCharging size={14} color="#33FFCC" /> ERS BATTERY STORE
            </span>
            <span className={`ers-mode-badge mode-${ersModeText.toLowerCase()}`}>
              MODE: {ersModeText}
            </span>
          </div>
          <div className="readout-value mono" style={{ fontSize: '1.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>{ersPercent.toFixed(0)}<span className="readout-unit">%</span></span>
            {carStatus?.ERSStoreEnergy !== undefined && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                ({(carStatus.ERSStoreEnergy / 1000000.0).toFixed(2)} MJ)
              </span>
            )}
          </div>
          <div className="bar-container" style={{ marginTop: '0.5rem' }}>
            <div className="bar-fill ers-fill" style={{ width: `${ersPercent}%` }} />
          </div>
        </div>

        {/* Fuel Tank Panel */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Fuel size={14} color="#FF9933" /> FUEL IN TANK
            </span>
          </div>
          <div className="readout-value mono" style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>
            {fuel} <span className="readout-unit">KG</span>
          </div>
          <div className="bar-container" style={{ marginTop: '0.5rem' }}>
            <div className="bar-fill fuel-fill" style={{ width: `${fuelPercent}%` }} />
          </div>
        </div>

        {/* Tyre Compound & Age */}
        <div className="status-card">
          <div className="status-card-header">
            <span className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Disc size={14} color="#FF3366" /> TYRE SET
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {tyre ? (
              <div
                className="tyre-badge-large mono"
                style={{ color: tyre.color, backgroundColor: tyre.bg, borderColor: tyre.color }}
              >
                {tyre.label}
              </div>
            ) : (
              <div className="tyre-badge-large mono" style={{ color: '#888', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                -
              </div>
            )}
            <div>
              <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {carStatus?.TyresAgeLaps !== undefined ? `${carStatus.TyresAgeLaps} Laps Old` : 'Fresh Set'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {tyre?.label === 'S' ? 'Soft Compound' : tyre?.label === 'M' ? 'Medium Compound' : tyre?.label === 'H' ? 'Hard Compound' : 'Wet / Inter'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
