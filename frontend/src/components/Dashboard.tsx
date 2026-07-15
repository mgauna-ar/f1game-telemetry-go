import React from 'react';
import { Gauge, AlertCircle, Timer, Activity, Map } from 'lucide-react';
import { useTelemetry } from '../hooks/useTelemetry';
import { TelemetryChart } from './TelemetryChart';
import { TrackMap } from './TrackMap';

const WS_URL = 'ws://localhost:8080/ws';

export const Dashboard: React.FC = () => {
  const { telemetry, lap, motion, trackPath, connected, history } = useTelemetry(WS_URL);

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
      <header className="header">
        <div>
          <h1>F1 Telemetry</h1>
          <p className="mono" style={{ color: 'var(--text-secondary)' }}>
            Live Session Data
          </p>
        </div>
        <div>
          <span className={`status-dot ${connected ? 'status-live' : ''}`} />
          <span style={{ marginLeft: '8px', color: connected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>
      </header>

      {/* Main Speedometer */}
      <div className="glass-panel speedometer">
        <Gauge size={32} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
        <div className="readout-group">
          <div className="readout-value">
            {telemetry?.Speed || 0}
            <span className="readout-unit">KM/H</span>
          </div>
          <div className="readout-label">Speed</div>
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
            return (
              <div 
                key={i} 
                className={`rpm-led ${active ? color : ''}`} 
              />
            );
          })}
        </div>
      </div>

      {/* Input Gauges */}
      <div className="glass-panel gauges">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="readout-label">Throttle</span>
            <span className="mono">{Math.round((telemetry?.Throttle || 0) * 100)}%</span>
          </div>
          <div className="bar-container">
            <div 
              className="bar-fill throttle-fill" 
              style={{ width: `${(telemetry?.Throttle || 0) * 100}%` }} 
            />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="readout-label">Brake</span>
            <span className="mono">{Math.round((telemetry?.Brake || 0) * 100)}%</span>
          </div>
          <div className="bar-container">
            <div 
              className="bar-fill brake-fill" 
              style={{ width: `${(telemetry?.Brake || 0) * 100}%` }} 
            />
          </div>
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="readout-label">Steer</span>
            <span className="mono">{((telemetry?.Steer || 0) * 100).toFixed(1)}%</span>
          </div>
          <div className="bar-container" style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '50%', height: '100%', position: 'relative' }}>
              <div 
                className="bar-fill" 
                style={{ 
                  position: 'absolute', right: 0, 
                  width: `${(telemetry?.Steer || 0) < 0 ? Math.abs((telemetry?.Steer || 0) * 100) : 0}%`,
                  backgroundColor: 'white' 
                }} 
              />
            </div>
            <div style={{ width: '50%', height: '100%', position: 'relative' }}>
              <div 
                className="bar-fill" 
                style={{ 
                  position: 'absolute', left: 0, 
                  width: `${(telemetry?.Steer || 0) > 0 ? (telemetry?.Steer || 0) * 100 : 0}%`,
                  backgroundColor: 'white' 
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Gear & DRS */}
      <div className="glass-panel indicators">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="readout-label" style={{ marginBottom: '0.5rem' }}>GEAR</div>
          <div className="gear-display">
            {getGear(telemetry?.Gear)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={`indicator-box ${telemetry?.DRS ? 'active-drs' : ''}`}>
            <span className="readout-label" style={{ marginBottom: '0.25rem' }}>DRS</span>
            <span style={{ fontWeight: 'bold' }}>{telemetry?.DRS ? 'ENABLED' : 'OFF'}</span>
          </div>
          <div className="indicator-box">
            <span className="readout-label" style={{ marginBottom: '0.25rem' }}>RPM</span>
            <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {telemetry?.EngineRPM || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Lap Times */}
      <div className="glass-panel" style={{ gridColumn: 'span 12' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer size={20} /> Lap Timing
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem', marginTop: '1.5rem' }}>
          <div className="readout-group">
            <div className="readout-label">Current Lap</div>
            <div className="readout-value" style={{ color: lap?.CurrentLapInvalid ? 'var(--accent-primary)' : 'inherit' }}>
              {formatTime(lap?.CurrentLapTimeInMS || 0)}
            </div>
            {lap?.CurrentLapInvalid ? <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem' }}><AlertCircle size={12} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Invalidated</span> : null}
          </div>

          <div className="readout-group">
            <div className="readout-label">Last Lap</div>
            <div className="readout-value mono" style={{ fontSize: '2rem' }}>
              {formatTime(lap?.LastLapTimeInMS || 0)}
            </div>
          </div>

          <div className="readout-group">
            <div className="readout-label">Sector 1</div>
            <div className="readout-value mono" style={{ fontSize: '2rem' }}>
              {formatTime(lap?.Sector1TimeMSPart || 0)}
            </div>
          </div>

          <div className="readout-group">
            <div className="readout-label">Sector 2</div>
            <div className="readout-value mono" style={{ fontSize: '2rem' }}>
              {formatTime(lap?.Sector2TimeMSPart || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Track Map */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', marginTop: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <Map size={20} /> Live Track Map
        </h3>
        <TrackMap motion={motion} trackPath={trackPath} />
      </div>

      {/* Live Telemetry Chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', marginTop: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
          <Activity size={20} /> Live Telemetry Trace
        </h3>
        <TelemetryChart data={history} />
      </div>
    </div>
  );
};
