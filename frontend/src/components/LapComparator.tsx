import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Session {
  id: number;
  session_uid: string;
  track_name: string;
  session_type: string;
  created_at: string;
}

interface Participant {
  id: number;
  session_id: number;
  car_index: number;
  name: string;
  driver_id: number;
  team_id: number;
  race_number: number;
  ai_controlled: boolean;
  nationality: number;
  created_at?: string;
}

interface Lap {
  id: number;
  session_id: number;
  car_index?: number;
  lap_number: number;
  lap_time_ms: number;
  is_valid: boolean;
}

interface TelemetrySample {
  id: number;
  car_index?: number;
  lap_distance: number;
  session_time: number;
  speed: number;
  throttle: number;
  brake: number;
  ers_store_energy?: number;
  ers_deploy_mode?: number;
}

export const LapComparator: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [lapAId, setLapAId] = useState<number | ''>('');
  const [lapBId, setLapBId] = useState<number | ''>('');
  
  const [telemetryA, setTelemetryA] = useState<TelemetrySample[]>([]);
  const [telemetryB, setTelemetryB] = useState<TelemetrySample[]>([]);
  
  const [xAxisType, setXAxisType] = useState<'distance' | 'time'>('distance');

  const fetchSessions = () => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => setSessions(data || []))
      .catch(err => console.error("Failed to fetch sessions", err));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/laps/import', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        e.target.value = '';
        fetchSessions();
      } else {
        console.error('Failed to import ghost lap');
      }
    } catch (err) {
      console.error('Error importing ghost lap', err);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      fetch(`/api/sessions/${selectedSessionId}/laps`)
        .then(res => res.json())
        .then(data => setLaps(data || []))
        .catch(err => console.error("Failed to fetch laps", err));

      fetch(`/api/sessions/${selectedSessionId}/participants`)
        .then(res => res.json())
        .then(data => setParticipants(data || []))
        .catch(err => console.error("Failed to fetch participants", err));
    } else {
      setLaps([]);
      setParticipants([]);
      setLapAId('');
      setLapBId('');
    }
  }, [selectedSessionId]);

  useEffect(() => {
    if (lapAId) {
      fetch(`/api/laps/${lapAId}/telemetry`)
        .then(res => res.json())
        .then(data => setTelemetryA(data || []))
        .catch(err => console.error("Failed to fetch telemetry A", err));
    } else {
      setTelemetryA([]);
    }
  }, [lapAId]);

  useEffect(() => {
    if (lapBId) {
      fetch(`/api/laps/${lapBId}/telemetry`)
        .then(res => res.json())
        .then(data => setTelemetryB(data || []))
        .catch(err => console.error("Failed to fetch telemetry B", err));
    } else {
      setTelemetryB([]);
    }
  }, [lapBId]);

  const normA = normalizeTime(telemetryA);
  const normB = normalizeTime(telemetryB);

  const formatLapOption = (l: Lap) => {
    const p = l.car_index !== undefined && l.car_index !== null 
      ? participants.find(part => part.car_index === l.car_index) 
      : undefined;
    
    const timeStr = formatTime(l.lap_time_ms);
    const driverLabel = p 
      ? `${p.name}${p.race_number !== undefined && p.race_number !== null ? ` (#${p.race_number})` : ''}`
      : (l.car_index !== undefined && l.car_index !== null ? `Car ${l.car_index}` : null);

    if (driverLabel) {
      return `Lap ${l.lap_number} — ${driverLabel} — ${timeStr}`;
    }
    return `Lap ${l.lap_number} (${timeStr})`;
  };

  const renderLapSelectOptions = () => {
    if (participants.length === 0) {
      return laps.map(l => (
        <option key={l.id} value={l.id}>{formatLapOption(l)}</option>
      ));
    }

    const carIndicesWithLaps = Array.from(new Set(laps.map(l => l.car_index ?? -1)));
    
    return carIndicesWithLaps.map(carIdx => {
      const p = participants.find(part => part.car_index === carIdx);
      const groupLabel = p 
        ? `${p.name}${p.race_number !== undefined && p.race_number !== null ? ` (#${p.race_number})` : ''}` 
        : (carIdx >= 0 ? `Car ${carIdx}` : 'Ghost / Imported Laps');

      const driverLaps = laps.filter(l => (l.car_index ?? -1) === carIdx);

      return (
        <optgroup key={carIdx} label={groupLabel}>
          {driverLaps.map(l => (
            <option key={l.id} value={l.id}>
              Lap {l.lap_number} — {formatTime(l.lap_time_ms)}
            </option>
          ))}
        </optgroup>
      );
    });
  };

  return (
    <div className="dashboard-grid" style={{ paddingTop: 0 }}>
      <div className="header glass-panel" style={{ gridColumn: 'span 12' }}>
        <div>
          <h2>Lap Comparator</h2>
          <p className="text-secondary">Compare telemetry traces between two laps</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="readout-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Session</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                className="ui-select" 
                value={selectedSessionId} 
                onChange={e => setSelectedSessionId(Number(e.target.value) || '')}
              >
                <option value="">Select Session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.track_name} - {s.session_type} ({new Date(s.created_at).toLocaleDateString()})</option>
                ))}
              </select>
              <button 
                className="ui-select" 
                onClick={fetchSessions} 
                style={{ cursor: 'pointer', background: '#2a2a2a', border: '1px solid #444', color: '#fff', padding: '0.35rem 0.6rem' }}
                title="Refresh sessions list"
              >
                🔄
              </button>
            </div>
          </div>

          <div>
            <label className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#ff4757', fontWeight: 'bold' }}>●</span> Lap A (Red)
            </label>
            <select 
              className="ui-select" 
              value={lapAId} 
              onChange={e => setLapAId(Number(e.target.value) || '')}
              disabled={!selectedSessionId}
            >
              <option value="">Select Lap A...</option>
              {renderLapSelectOptions()}
            </select>
          </div>

          <div>
            <label className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>●</span> Lap B (Cyan)
            </label>
            <select 
              className="ui-select" 
              value={lapBId} 
              onChange={e => setLapBId(Number(e.target.value) || '')}
              disabled={!selectedSessionId}
            >
              <option value="">Select Lap B...</option>
              {renderLapSelectOptions()}
            </select>
          </div>

          <div>
            <label className="readout-label" style={{ display: 'block', marginBottom: '0.25rem' }}>X-Axis</label>
            <select 
              className="ui-select" 
              value={xAxisType} 
              onChange={e => setXAxisType(e.target.value as 'distance' | 'time')}
            >
              <option value="distance">Distance (m)</option>
              <option value="time">Time (s)</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
            <label className="ui-select" style={{ cursor: 'pointer', display: 'inline-block', background: '#333', color: '#fff', border: '1px solid #444', padding: '0.35rem 0.75rem', borderRadius: '4px', textAlign: 'center' }}>
              Import Ghost
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
            
            {lapAId && (
              <a 
                href={`/api/laps/${lapAId}/export`}
                className="ui-select" 
                style={{ display: 'inline-block', background: 'var(--accent-primary)', color: '#000', textDecoration: 'none', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}
              >
                Export Lap A
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Participants Roster Panel */}
      {selectedSessionId !== '' && (
        <div className="glass-panel" style={{ gridColumn: 'span 12', padding: '1rem 1.25rem', marginTop: '-0.5rem' }}>
          <h4 className="readout-label" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🏎️ Session Participants ({participants.length})
          </h4>
          {participants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              No participant metadata recorded for this session.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {participants.map(p => (
                <div 
                  key={p.id || `car-${p.car_index}`}
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.35)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-sm)', 
                    padding: '0.4rem 0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    fontSize: '0.85rem' 
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)' }}>
                    #{p.race_number}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.06)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                    Team {p.team_id}
                  </span>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 700, 
                    padding: '0.1rem 0.4rem', 
                    borderRadius: '999px',
                    background: p.ai_controlled ? 'rgba(255, 165, 0, 0.15)' : 'rgba(0, 210, 211, 0.15)',
                    color: p.ai_controlled ? '#ffa500' : '#00d2d3',
                    border: `1px solid ${p.ai_controlled ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 210, 211, 0.3)'}`
                  }}>
                    {p.ai_controlled ? 'AI' : 'HUMAN'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Speed Sub-chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '280px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#ccc' }}>Speed (KM/H)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis stroke="#666" tick={{ fill: '#999' }} domain={[0, 360]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              {normA.length > 0 && (
                <Line type="monotone" data={normA} dataKey="speed" name="Speed - Lap A (Red Solid)" stroke="#ff4757" dot={false} strokeWidth={2.5} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="speed" name="Speed - Lap B (Cyan Dashed)" stroke="#00d2d3" dot={false} strokeWidth={2.5} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Throttle Sub-chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '240px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#ccc' }}>Throttle (0 - 100%)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis stroke="#666" tick={{ fill: '#999' }} domain={[0, 1]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              {normA.length > 0 && (
                <Line type="monotone" data={normA} dataKey="throttle" name="Throttle - Lap A (Red Solid)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="throttle" name="Throttle - Lap B (Cyan Dashed)" stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Brake Sub-chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '240px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#ccc' }}>Brake (0 - 100%)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis stroke="#666" tick={{ fill: '#999' }} domain={[0, 1]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              {normA.length > 0 && (
                <Line type="monotone" data={normA} dataKey="brake" name="Brake - Lap A (Red Solid)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="brake" name="Brake - Lap B (Cyan Dashed)" stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ERS Battery Level Sub-chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '240px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#ccc' }}>ERS Battery Level (0 - 100% Store Energy)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis stroke="#666" tick={{ fill: '#999' }} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Battery']}
              />
              <Legend />
              {normA.length > 0 && (
                <Line type="monotone" data={normA} dataKey="ers_store_energy" name="ERS Battery - Lap A (Red Solid)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="ers_store_energy" name="ERS Battery - Lap B (Cyan Dashed)" stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ERS Deploy Mode Sub-chart */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '240px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#ccc' }}>ERS Deploy Mode (0: None, 1: Medium, 2: Hotlap, 3: Overtake)</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#999' }} 
                domain={[0, 3]} 
                ticks={[0, 1, 2, 3]}
                tickFormatter={(val) => {
                  const modes = ['None', 'Medium', 'Hotlap', 'Overtake'];
                  return modes[val] !== undefined ? `${val}: ${modes[val]}` : `${val}`;
                }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                itemStyle={{ color: '#fff' }}
                formatter={(value: any) => {
                  const modes = ['0: None', '1: Medium', '2: Hotlap', '3: Overtake'];
                  return [modes[Number(value)] ?? `${value}`, 'Deploy Mode'];
                }}
              />
              <Legend />
              {normA.length > 0 && (
                <Line type="stepAfter" data={normA} dataKey="ers_deploy_mode" name="Deploy Mode - Lap A (Red Solid)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="stepAfter" data={normB} dataKey="ers_deploy_mode" name="Deploy Mode - Lap B (Cyan Dashed)" stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Helpers
function formatTime(ms: number) {
  if (!ms) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const m = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, '0')}.${m.toString().padStart(3, '0')}`;
}

// Normalize session_time to start from 0 and compute fallback lap_distance if missing/zero
function normalizeTime(samples: TelemetrySample[]) {
  if (samples.length === 0) return samples;
  const startTime = samples[0].session_time;
  const hasValidDistance = samples.some(s => s.lap_distance && s.lap_distance > 0);

  let accumulatedDist = 0;

  return samples.map((s, idx) => {
    let lapDist = s.lap_distance || 0;

    if (!hasValidDistance) {
      if (idx > 0) {
        const dt = s.session_time - samples[idx - 1].session_time;
        if (dt > 0 && dt < 5) {
          const speedMS = (s.speed * 1000) / 3600;
          accumulatedDist += speedMS * dt;
        }
      }
      lapDist = Math.round(accumulatedDist * 10) / 10;
    }

    return {
      ...s,
      lap_distance: lapDist,
      session_time: Math.round((s.session_time - startTime) * 1000) / 1000
    };
  });
}
