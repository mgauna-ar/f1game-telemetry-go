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
        // optionally alert or toast here
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

  return (
    <div className="dashboard-grid" style={{ paddingTop: 0 }}>
      <div className="header glass-panel" style={{ gridColumn: 'span 12' }}>
        <div>
          <h2>Lap Comparator</h2>
          <p className="text-secondary">Compare telemetry across two laps</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <label className="readout-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Session</label>
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
          </div>

          <div>
            <label className="readout-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Lap A (Red)</label>
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
            <label className="readout-label" style={{ display: 'block', marginBottom: '0.25rem' }}>Lap B (Blue)</label>
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

      <div className="glass-panel" style={{ gridColumn: 'span 12', height: '600px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1rem' }}>Telemetry Overlay</h3>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey={xAxisType === 'distance' ? 'lap_distance' : 'session_time'} 
                type="number" 
                domain={['auto', 'auto']}
                stroke="#666" 
                tick={{ fill: '#999' }}
              />
              <YAxis yAxisId="speed" stroke="#666" tick={{ fill: '#999' }} domain={[0, 350]} />
              <YAxis yAxisId="inputs" orientation="right" stroke="#666" tick={{ fill: '#999' }} domain={[0, 1]} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              
              {/* Lap A */}
              {telemetryA.length > 0 && (
                <>
                  <Line yAxisId="speed" type="monotone" data={normalizeTime(telemetryA)} dataKey="speed" name="Speed A" stroke="var(--accent-primary)" dot={false} strokeWidth={2} />
                  <Line yAxisId="inputs" type="monotone" data={normalizeTime(telemetryA)} dataKey="throttle" name="Throttle A" stroke="var(--accent-tertiary)" dot={false} strokeDasharray="5 5" />
                  <Line yAxisId="inputs" type="monotone" data={normalizeTime(telemetryA)} dataKey="brake" name="Brake A" stroke="var(--accent-warning)" dot={false} strokeDasharray="5 5" />
                </>
              )}

              {/* Lap B */}
              {telemetryB.length > 0 && (
                <>
                  <Line yAxisId="speed" type="monotone" data={normalizeTime(telemetryB)} dataKey="speed" name="Speed B" stroke="var(--accent-secondary)" dot={false} strokeWidth={2} />
                  <Line yAxisId="inputs" type="monotone" data={normalizeTime(telemetryB)} dataKey="throttle" name="Throttle B" stroke="hsl(150, 60%, 60%)" dot={false} strokeDasharray="2 2" />
                  <Line yAxisId="inputs" type="monotone" data={normalizeTime(telemetryB)} dataKey="brake" name="Brake B" stroke="hsl(45, 80%, 60%)" dot={false} strokeDasharray="2 2" />
                </>
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
