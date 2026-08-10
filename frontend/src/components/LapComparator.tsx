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

interface Lap {
  id: number;
  session_id: number;
  lap_number: number;
  lap_time_ms: number;
  is_valid: boolean;
}

interface TelemetrySample {
  id: number;
  lap_distance: number;
  session_time: number;
  speed: number;
  throttle: number;
  brake: number;
}

export const LapComparator: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');
  
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
    } else {
      setLaps([]);
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
              {laps.map(l => (
                <option key={l.id} value={l.id}>Lap {l.lap_number} ({formatTime(l.lap_time_ms)})</option>
              ))}
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
              {laps.map(l => (
                <option key={l.id} value={l.id}>Lap {l.lap_number} ({formatTime(l.lap_time_ms)})</option>
              ))}
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
                <Line type="monotone" data={normA} dataKey="speed" name="Speed - Lap A (Red)" stroke="#ff4757" dot={false} strokeWidth={2.5} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="speed" name="Speed - Lap B (Cyan)" stroke="#00d2d3" dot={false} strokeWidth={2.5} />
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
                <Line type="monotone" data={normA} dataKey="throttle" name="Throttle - Lap A (Red)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="throttle" name="Throttle - Lap B (Cyan)" stroke="#00d2d3" dot={false} strokeWidth={2} />
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
                <Line type="monotone" data={normA} dataKey="brake" name="Brake - Lap A (Red)" stroke="#ff4757" dot={false} strokeWidth={2} />
              )}
              {normB.length > 0 && (
                <Line type="monotone" data={normB} dataKey="brake" name="Brake - Lap B (Cyan)" stroke="#00d2d3" dot={false} strokeWidth={2} />
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

// Normalize session_time to start from 0 for a lap comparison
function normalizeTime(samples: TelemetrySample[]) {
  if (samples.length === 0) return samples;
  const startTime = samples[0].session_time;
  return samples.map(s => ({
    ...s,
    session_time: s.session_time - startTime
  }));
}
