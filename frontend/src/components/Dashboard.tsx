import React from 'react';
import { Gauge, AlertCircle, Timer, Map } from 'lucide-react';
import { useTelemetry, parseDriverName } from '../hooks/useTelemetry';
import { TrackMap } from './TrackMap';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { CarStatusWidget } from './CarStatusWidget';
import { CarDamageWidget } from './CarDamageWidget';

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
    carDamage = null,
    trackPath = [],
    connected = false,
    playerCarIndex = 0,
    selectedCarIndex = 0,
    setSelectedCarIndex = () => {},
  } = useTelemetry();

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

      {/* Hero Upper Section: Standings Tower (Span 4) + Prominent Live Track Map & Lap Timing (Span 8) */}
      <div className="dash-hero-row" style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
        {/* Standings Tower */}
        <div className="dash-hero-tower" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column' }}>
          <LeaderboardTower
            session={session}
            participants={participants}
            laps={allLaps}
            carStatuses={allCarStatus}
            playerCarIndex={playerCarIndex}
            selectedCarIndex={selectedCarIndex}
            onSelectCar={setSelectedCarIndex}
          />
        </div>

        {/* Right Hero Column: Live Multi-Car Track Map + Lap Timing */}
        <div className="dash-hero-right" style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Live Multi-Car Track Map - High Priority Map Hero */}
          <div className="glass-panel dash-track-map-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>
              <Map size={20} color="var(--accent-primary)" /> Live Multi-Car Track Map
            </h3>
            <div style={{ flex: 1, minHeight: '340px' }}>
              <TrackMap
                motion={motion}
                allMotion={allMotion}
                participants={participants}
                selectedCarIndex={selectedCarIndex}
                trackPath={trackPath}
              />
            </div>
          </div>

          {/* Lap Timing - Located directly below track map */}
          <div className="glass-panel dash-lap-timing-panel">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              <Timer size={18} color="var(--accent-primary)" /> Lap Timing ({driverName})
            </h3>

            <div className="lap-timing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div className="readout-group">
                <div className="readout-label">Current Lap</div>
                <div className="readout-value mono" style={{ fontSize: '1.4rem', color: lap?.CurrentLapInvalid ? 'var(--accent-primary)' : 'inherit' }}>
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
                <div className="readout-value mono" style={{ fontSize: '1.4rem' }}>
                  {formatTime(lap?.LastLapTimeInMS || 0)}
                </div>
              </div>

              <div className="readout-group">
                <div className="readout-label">Sector 1</div>
                <div className="readout-value mono" style={{ fontSize: '1.4rem' }}>
                  {formatTime(lap?.Sector1TimeMSPart || 0)}
                </div>
              </div>

              <div className="readout-group">
                <div className="readout-label">Sector 2</div>
                <div className="readout-value mono" style={{ fontSize: '1.4rem' }}>
                  {formatTime(lap?.Sector2TimeMSPart || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Pit Wall Status (Span 6) + Speedometer & Gauges (Span 6) */}
      <div className="dash-middle-row" style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
        {/* Car Status & Pit Wall Telemetry Widget */}
        <div className="dash-status-col" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column' }}>
          <CarStatusWidget carStatus={carStatus} driverName={driverName} />
        </div>

        {/* Speedometer & Gauges */}
        <div className="dash-telemetry-col" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel car-status-widget" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="status-widget-header">
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={18} color="var(--accent-primary)" />
                Live Driver Telemetry & Controls
              </h3>
              <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600, background: 'rgba(51, 255, 204, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(51, 255, 204, 0.3)' }}>
                LIVE TELEMETRY
              </span>
            </div>

            <div className="status-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem', alignItems: 'stretch' }}>
              {/* Main Speedometer */}
              <div className="status-card speedometer" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                <Gauge size={20} color="var(--text-secondary)" style={{ marginBottom: '0.25rem' }} />
                <div className="readout-group" style={{ textAlign: 'center', width: '100%' }}>
                  <div className="readout-value" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>
                    {telemetry?.Speed || 0}
                    <span className="readout-unit" style={{ fontSize: '0.9rem', marginLeft: '4px' }}>KM/H</span>
                  </div>
                  <div className="readout-label" style={{ fontSize: '0.75rem', marginTop: '4px' }}>Speed ({driverName})</div>
                </div>

                {/* RPM LEDs */}
                <div className="rpm-leds" style={{ width: '100%', marginTop: '0.5rem' }}>
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
              <div className="status-card gauges" style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="readout-label" style={{ fontSize: '0.75rem' }}>Throttle</span>
                    <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{Math.round(Math.min(100, Math.max(0, (telemetry?.Throttle || 0) * (telemetry?.Throttle && telemetry.Throttle <= 1.0 ? 100 : 1))))}%</span>
                  </div>
                  <div className="bar-container" style={{ height: '14px' }}>
                    <div className="bar-fill throttle-fill" style={{ width: `${Math.min(100, Math.max(0, (telemetry?.Throttle || 0) * (telemetry?.Throttle && telemetry.Throttle <= 1.0 ? 100 : 1)))}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="readout-label" style={{ fontSize: '0.75rem' }}>Brake</span>
                    <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{Math.round(Math.min(100, Math.max(0, (telemetry?.Brake || 0) * (telemetry?.Brake && telemetry.Brake <= 1.0 ? 100 : 1))))}%</span>
                  </div>
                  <div className="bar-container" style={{ height: '14px' }}>
                    <div className="bar-fill brake-fill" style={{ width: `${Math.min(100, Math.max(0, (telemetry?.Brake || 0) * (telemetry?.Brake && telemetry.Brake <= 1.0 ? 100 : 1)))}%` }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="readout-label" style={{ fontSize: '0.75rem' }}>Steer</span>
                    <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{((telemetry?.Steer || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bar-container" style={{ display: 'flex', alignItems: 'center', height: '14px' }}>
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
              <div className="status-card indicators" style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="readout-label" style={{ marginBottom: '0.2rem', fontSize: '0.7rem' }}>GEAR</div>
                  <div className="gear-display" style={{ width: '44px', height: '44px', lineHeight: '44px', fontSize: '1.75rem' }}>
                    {getGear(telemetry?.Gear)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%', justifyContent: 'center' }}>
                  <div className={`indicator-box ${telemetry?.DRS ? 'active-drs' : ''}`} style={{ padding: '0.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="readout-label" style={{ fontSize: '0.65rem' }}>DRS</span>
                    <span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>{telemetry?.DRS ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="indicator-box" style={{ padding: '0.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="readout-label" style={{ fontSize: '0.65rem' }}>RPM</span>
                    <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {telemetry?.EngineRPM || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Car Damage & Tyre Wear Telemetry Widget */}
      <div className="dash-bottom-row" style={{ gridColumn: 'span 12' }}>
        <CarDamageWidget carDamage={carDamage} driverName={driverName} />
      </div>
    </div>
  );
};
