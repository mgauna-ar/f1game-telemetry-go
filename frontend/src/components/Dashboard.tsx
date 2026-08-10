import React from 'react';
import { Gauge, AlertCircle, Timer, Activity, Map } from 'lucide-react';
import { useTelemetry, parseDriverName } from '../hooks/useTelemetry';
import { TelemetryChart } from './TelemetryChart';
import { TrackMap } from './TrackMap';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { CarStatusWidget } from './CarStatusWidget';

const WS_URL = 'ws://localhost:8080/ws';

export const Dashboard: React.FC = () => {
  const {
    session = null,
    participants = [],
    allLaps = [],
    allMotion = [],
    allCarStatus = [],
    telemetry = null,
    lap = null,
    motion = null,
    carStatus = null,
    trackPath = [],
    connected = false,
    history = [],
    playerCarIndex = 0,
    selectedCarIndex = 0,
    setSelectedCarIndex = () => {},
  } = useTelemetry(WS_URL);

  const selectedParticipant = (participants || [])[selectedCarIndex || 0];
  const driverName = parseDriverName(selectedParticipant?.Name, `Car #${(selectedCarIndex || 0) + 1}`);

  const formatTime = (ms: number) => {
    if (!ms) return '--:--.---';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const getGear = (g?: number) => {
    if (g === undefined) return '-';
    if (g === 0) return 'N';
    if (g === -1) return 'R';
    return g.toString();
  };

  return (
    <div className="dashboard-grid">
      {/* Session Top Header */}
      <SessionHeader session={session} connected={connected} />

      {/* Standings Tower (Left Column) */}
      <LeaderboardTower
        session={session}
        participants={participants}
        laps={allLaps}
        carStatuses={allCarStatus}
        playerCarIndex={playerCarIndex}
        selectedCarIndex={selectedCarIndex}
        onSelectCar={setSelectedCarIndex}
      />

      {/* Right Column Layout */}
      <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Car Status & Pit Wall Telemetry Widget */}
        <CarStatusWidget carStatus={carStatus} driverName={driverName} />

        {/* Speedometer, Gauges & Indicators Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
          {/* Main Speedometer */}
          <div className="glass-panel speedometer" style={{ gridColumn: 'span 4' }}>
            <Gauge size={24} color="var(--text-secondary)" style={{ marginBottom: '0.5rem' }} />
            <div className="readout-group">
              <div className="readout-value" style={{ fontSize: '3.5rem' }}>
                {telemetry?.Speed || 0}
                <span className="readout-unit">KM/H</span>
              </div>
              <div className="readout-label">Speed ({driverName})</div>
            </div>

            {/* RPM LEDs */}
            <div className="rpm-leds">
              {[...Array(15)].map((_, i) => {
                const percent = telemetry?.RevLightsPercent || 0;
                const threshold = (i + 1) * (100 / 15);
                const active = percent >= threshold;
                let color = 'green';
                if (i > 10) color = 'red';
                if (i > 13) color = 'blue';
                return <div key={i} className={`rpm-led ${active ? color : ''}`} />;
              })}
            </div>
          </div>

          {/* Input Gauges */}
          <div className="glass-panel gauges" style={{ gridColumn: 'span 5' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="readout-label">Throttle</span>
                <span className="mono" style={{ fontSize: '0.85rem' }}>{Math.round((telemetry?.Throttle || 0) * 100)}%</span>
              </div>
              <div className="bar-container" style={{ height: '16px' }}>
                <div className="bar-fill throttle-fill" style={{ width: `${(telemetry?.Throttle || 0) * 100}%` }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="readout-label">Brake</span>
                <span className="mono" style={{ fontSize: '0.85rem' }}>{Math.round((telemetry?.Brake || 0) * 100)}%</span>
              </div>
              <div className="bar-container" style={{ height: '16px' }}>
                <div className="bar-fill brake-fill" style={{ width: `${(telemetry?.Brake || 0) * 100}%` }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="readout-label">Steer</span>
                <span className="mono" style={{ fontSize: '0.85rem' }}>{((telemetry?.Steer || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="bar-container" style={{ display: 'flex', alignItems: 'center', height: '16px' }}>
                <div style={{ width: '50%', height: '100%', position: 'relative' }}>
                  <div
                    className="bar-fill"
                    style={{
                      position: 'absolute',
                      right: 0,
                      width: `${(telemetry?.Steer || 0) < 0 ? Math.abs((telemetry?.Steer || 0) * 100) : 0}%`,
                      backgroundColor: 'white',
                    }}
                  />
                </div>
                <div style={{ width: '50%', height: '100%', position: 'relative' }}>
                  <div
                    className="bar-fill"
                    style={{
                      position: 'absolute',
                      left: 0,
                      width: `${(telemetry?.Steer || 0) > 0 ? (telemetry?.Steer || 0) * 100 : 0}%`,
                      backgroundColor: 'white',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gear & DRS */}
          <div className="glass-panel indicators" style={{ gridColumn: 'span 3', padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="readout-label" style={{ marginBottom: '0.25rem', fontSize: '0.75rem' }}>GEAR</div>
              <div className="gear-display" style={{ width: '60px', height: '60px', lineHeight: '60px', fontSize: '2.5rem' }}>
                {getGear(telemetry?.Gear)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <div className={`indicator-box ${telemetry?.DRS ? 'active-drs' : ''}`} style={{ padding: '0.4rem' }}>
                <span className="readout-label" style={{ fontSize: '0.65rem' }}>DRS</span>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{telemetry?.DRS ? 'DRS ON' : 'OFF'}</span>
              </div>
              <div className="indicator-box" style={{ padding: '0.4rem' }}>
                <span className="readout-label" style={{ fontSize: '0.65rem' }}>RPM</span>
                <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {telemetry?.EngineRPM || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lap Times */}
        <div className="glass-panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '1rem' }}>
            <Timer size={18} /> Lap Timing ({driverName})
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="readout-group">
              <div className="readout-label">Current Lap</div>
              <div className="readout-value mono" style={{ fontSize: '1.5rem', color: lap?.CurrentLapInvalid ? 'var(--accent-primary)' : 'inherit' }}>
                {formatTime(lap?.CurrentLapTimeInMS || 0)}
              </div>
              {lap?.CurrentLapInvalid ? (
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>
                  <AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Invalidated
                </span>
              ) : null}
            </div>

            <div className="readout-group">
              <div className="readout-label">Last Lap</div>
              <div className="readout-value mono" style={{ fontSize: '1.5rem' }}>
                {formatTime(lap?.LastLapTimeInMS || 0)}
              </div>
            </div>

            <div className="readout-group">
              <div className="readout-label">Sector 1</div>
              <div className="readout-value mono" style={{ fontSize: '1.5rem' }}>
                {formatTime(lap?.Sector1TimeMSPart || 0)}
              </div>
            </div>

            <div className="readout-group">
              <div className="readout-label">Sector 2</div>
              <div className="readout-value mono" style={{ fontSize: '1.5rem' }}>
                {formatTime(lap?.Sector2TimeMSPart || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Car Track Map */}
      <div className="glass-panel" style={{ gridColumn: 'span 6', marginTop: '0.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '1rem' }}>
          <Map size={18} /> Live Multi-Car Track Map
        </h3>
        <TrackMap
          motion={motion}
          allMotion={allMotion}
          participants={participants}
          selectedCarIndex={selectedCarIndex}
          trackPath={trackPath}
        />
      </div>

      {/* Live Telemetry Chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 6', marginTop: '0.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '1rem' }}>
          <Activity size={18} /> Live Telemetry Trace ({driverName})
        </h3>
        <TelemetryChart data={history} />
      </div>
    </div>
  );
};

