import React from 'react';
import { Gauge, AlertCircle, Timer, Award, ShieldAlert, Flag } from 'lucide-react';
import { useTelemetry, parseDriverName } from '../hooks/useTelemetry';
import { SessionHeader } from './SessionHeader';
import { LeaderboardTower } from './LeaderboardTower';
import { CarStatusWidget } from './CarStatusWidget';
import { CarDamageWidget } from './CarDamageWidget';

export const Dashboard: React.FC = () => {
  const {
    session = null,
    participants = [],
    allLaps = [],
    allCarStatus = [],
    telemetry = null,
    lap = null,
    carStatus = null,
    carDamage = null,
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

  const getPitStatusText = (status?: number) => {
    if (status === 1) return 'In Pit Lane';
    if (status === 2) return 'Pitting';
    return 'On Track';
  };

  return (
    <div className="dashboard-grid">
      {/* Session Top Header */}
      <SessionHeader session={session} connected={connected} />

      {/* Hero Upper Section: Standings Tower (Span 5) + Live Lap Timing & Sector Performance (Span 7) */}
      <div className="dash-hero-row" style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
        {/* Standings Tower */}
        <div className="dash-hero-tower" style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column' }}>
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

        {/* Right Hero Column: Prominent Live Lap Timing & Sector Performance */}
        <div className="dash-hero-right" style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-panel dash-lap-timing-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', margin: 0 }}>
                <Timer size={20} color="var(--accent-primary)" /> Live Lap Timing & Sector Performance ({driverName})
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  P{lap?.CarPosition || (selectedCarIndex + 1)} • Lap {lap?.CurrentLapNum || 0}
                </span>
                {lap?.CurrentLapInvalid ? (
                  <span className="mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(255, 51, 85, 0.15)', border: '1px solid rgba(255, 51, 85, 0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> INVALIDATED
                  </span>
                ) : (
                  <span className="mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(51, 255, 204, 0.1)', border: '1px solid rgba(51, 255, 204, 0.3)' }}>
                    VALID LAP
                  </span>
                )}
              </div>
            </div>

            {/* Primary Lap Readouts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="readout-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>CURRENT LAP TIME</div>
                <div className="readout-value mono" style={{ fontSize: '2.2rem', fontWeight: 700, color: lap?.CurrentLapInvalid ? '#ff4d4d' : 'var(--accent-primary)', lineHeight: 1.1 }}>
                  {formatTime(lap?.CurrentLapTimeInMS || 0)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="readout-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>LAST LAP TIME</div>
                <div className="readout-value mono" style={{ fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1 }}>
                  {formatTime(lap?.LastLapTimeInMS || 0)}
                </div>
              </div>
            </div>

            {/* Sector Split Readouts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.15)', border: (lap?.Sector === 0 || lap?.Sector === 1) ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="readout-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>SECTOR 1</span>
                  {(lap?.Sector === 0 || lap?.Sector === 1) && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                </div>
                <div className="readout-value mono" style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: '4px' }}>
                  {formatTime(lap?.Sector1TimeMSPart || 0)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.15)', border: lap?.Sector === 2 ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="readout-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>SECTOR 2</span>
                  {lap?.Sector === 2 && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                </div>
                <div className="readout-value mono" style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: '4px' }}>
                  {formatTime(lap?.Sector2TimeMSPart || 0)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem', background: 'rgba(0,0,0,0.15)', border: lap?.Sector === 3 ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="readout-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>SECTOR 3</span>
                  {lap?.Sector === 3 && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                </div>
                <div className="readout-value mono" style={{ fontSize: '1.3rem', fontWeight: 600, marginTop: '4px' }}>
                  IN PROGRESS
                </div>
              </div>
            </div>

            {/* Quick Status & Race Control Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <Flag size={16} color="var(--accent-primary)" />
                <div>
                  <div className="readout-label" style={{ fontSize: '0.65rem' }}>PIT STATUS</div>
                  <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getPitStatusText(lap?.PitStatus)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <Award size={16} color="var(--accent-primary)" />
                <div>
                  <div className="readout-label" style={{ fontSize: '0.65rem' }}>PIT STOPS</div>
                  <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lap?.NumPitStops ?? 0} Stops</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <ShieldAlert size={16} color={(lap?.Penalties || 0) > 0 ? '#ff4d4d' : 'var(--text-secondary)'} />
                <div>
                  <div className="readout-label" style={{ fontSize: '0.65rem' }}>PENALTIES / WARNINGS</div>
                  <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, color: (lap?.Penalties || 0) > 0 ? '#ff4d4d' : 'inherit' }}>
                    {lap?.Penalties || 0}s / {lap?.TotalWarnings || 0} Warns
                  </div>
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
