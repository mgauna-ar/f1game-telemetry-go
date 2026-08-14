import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sliders, X, Shield, Disc, Wrench, CircleDot, Fuel, Gauge, Award, ArrowUpRight, ArrowDownRight, MapPin, Timer, Activity, ArrowLeftRight, Zap, RotateCcw, ZoomIn } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { lttbDownsample } from '../utils/downsample';
import type { TelemetrySamplePoint } from '../utils/downsample';
import { calculateMergedComparison } from '../utils/deltaCalculation';
import type { MergedTelemetryPoint } from '../utils/deltaCalculation';
import { buildTelemetryContext } from '../utils/aiTelemetrySummary';
import { ComparatorTrackMap } from './ComparatorTrackMap';
import { AiRaceEngineer } from './AiRaceEngineer';

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
}

interface CarSetup {
  id: number;
  session_id: number;
  car_index: number;
  front_wing: number;
  rear_wing: number;
  on_throttle: number;
  off_throttle: number;
  front_camber: number;
  rear_camber: number;
  front_toe: number;
  rear_toe: number;
  front_suspension: number;
  rear_suspension: number;
  front_anti_roll_bar: number;
  rear_anti_roll_bar: number;
  front_suspension_height: number;
  rear_suspension_height: number;
  brake_pressure: number;
  brake_bias: number;
  front_tyre_pressure: number;
  rear_tyre_pressure: number;
  ballast: number;
  fuel_load: number;
}

interface Lap {
  id: number;
  session_id: number;
  car_index?: number;
  lap_number: number;
  lap_time_ms: number;
  sector1_ms?: number;
  sector2_ms?: number;
  sector3_ms?: number;
  is_valid: boolean;
  tyre_compound?: string;
  fuel_load?: number;
  max_speed_kmh?: number;
}

const ERS_MODE_NAMES: Record<number, string> = {
  0: 'Off',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Overtake',
};

export const LapComparator: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | ''>('');

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [carSetups, setCarSetups] = useState<CarSetup[]>([]);
  const [activeSetupParticipant, setActiveSetupParticipant] = useState<{ participant: Participant; setup: CarSetup } | null>(null);

  const [laps, setLaps] = useState<Lap[]>([]);
  const [lapAId, setLapAId] = useState<number | ''>('');
  const [lapBId, setLapBId] = useState<number | ''>('');

  const [rawTelemetryA, setRawTelemetryA] = useState<TelemetrySamplePoint[]>([]);
  const [rawTelemetryB, setRawTelemetryB] = useState<TelemetrySamplePoint[]>([]);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  const fetchSessions = useCallback(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => setSessions(data || []))
      .catch((err) => console.error('Failed to fetch sessions', err));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    // Reset laps, telemetry, and zoom domain when session changes to avoid stale lap data
    setLapAId('');
    setLapBId('');
    setRawTelemetryA([]);
    setRawTelemetryB([]);
    setZoomDomain(null);

    if (selectedSessionId) {
      fetch(`/api/sessions/${selectedSessionId}/laps`)
        .then((res) => res.json())
        .then((data) => setLaps(data || []))
        .catch((err) => console.error('Failed to fetch laps', err));

      fetch(`/api/sessions/${selectedSessionId}/participants`)
        .then((res) => res.json())
        .then((data) => setParticipants(data || []))
        .catch((err) => console.error('Failed to fetch participants', err));

      fetch(`/api/sessions/${selectedSessionId}/setups`)
        .then((res) => res.json())
        .then((data) => setCarSetups(data || []))
        .catch((err) => console.error('Failed to fetch car setups', err));
    } else {
      setLaps([]);
      setParticipants([]);
      setCarSetups([]);
    }
  }, [selectedSessionId]);

  // Fetch Lap A telemetry with server-side LTTB downsampling parameter maxPoints=800
  useEffect(() => {
    setRawTelemetryA([]); // Instantly clear previous lap telemetry
    if (lapAId) {
      setLoadingA(true);
      fetch(`/api/laps/${lapAId}/telemetry?maxPoints=800`)
        .then((res) => res.json())
        .then((data) => {
          const samples: TelemetrySamplePoint[] = data || [];
          setRawTelemetryA(samples.length > 850 ? lttbDownsample(samples, 800) : samples);
        })
        .catch((err) => console.error('Failed to fetch telemetry A', err))
        .finally(() => setLoadingA(false));
    }
  }, [lapAId]);

  // Fetch Lap B telemetry with server-side LTTB downsampling parameter maxPoints=800
  useEffect(() => {
    setRawTelemetryB([]); // Instantly clear previous lap telemetry
    if (lapBId) {
      setLoadingB(true);
      fetch(`/api/laps/${lapBId}/telemetry?maxPoints=800`)
        .then((res) => res.json())
        .then((data) => {
          const samples: TelemetrySamplePoint[] = data || [];
          setRawTelemetryB(samples.length > 850 ? lttbDownsample(samples, 800) : samples);
        })
        .catch((err) => console.error('Failed to fetch telemetry B', err))
        .finally(() => setLoadingB(false));
    }
  }, [lapBId]);

  // Selected lap objects
  const lapAObj = useMemo(() => laps.find((l) => l.id === lapAId), [laps, lapAId]);
  const lapBObj = useMemo(() => laps.find((l) => l.id === lapBId), [laps, lapBId]);

  // Driver details for lap A & B
  const driverA = useMemo(
    () => (lapAObj?.car_index !== undefined ? participants.find((p) => p.car_index === lapAObj.car_index) : undefined),
    [lapAObj, participants]
  );
  const driverB = useMemo(
    () => (lapBObj?.car_index !== undefined ? participants.find((p) => p.car_index === lapBObj.car_index) : undefined),
    [lapBObj, participants]
  );

  const nameA = useMemo(() => (driverA ? `#${driverA.race_number} ${driverA.name}` : 'Lap A'), [driverA]);
  const nameB = useMemo(() => (driverB ? `#${driverB.race_number} ${driverB.name}` : 'Lap B'), [driverB]);

  // Setup details for Lap A & B
  const setupA = useMemo(
    () => (lapAObj?.car_index !== undefined ? carSetups.find((s) => s.car_index === lapAObj.car_index) : undefined),
    [lapAObj, carSetups]
  );
  const setupB = useMemo(
    () => (lapBObj?.car_index !== undefined ? carSetups.find((s) => s.car_index === lapBObj.car_index) : undefined),
    [lapBObj, carSetups]
  );

  // Calculate high-performance merged telemetry comparison points (resampled every 5 meters)
  const comparisonData = useMemo<MergedTelemetryPoint[]>(() => {
    if (rawTelemetryA.length === 0 && rawTelemetryB.length === 0) return [];
    return calculateMergedComparison(rawTelemetryA, rawTelemetryB, 5);
  }, [rawTelemetryA, rawTelemetryB]);

  // Filtered telemetry points based on active distance zoom domain
  const chartData = useMemo(() => {
    if (!zoomDomain || comparisonData.length === 0) return comparisonData;
    return comparisonData.filter(
      (p) => p.lap_distance >= zoomDomain[0] && p.lap_distance <= zoomDomain[1]
    );
  }, [comparisonData, zoomDomain]);

  // Sector Split Distances for Track Map and Chart Reference Lines
  const { sector1Distance, sector2Distance } = useMemo(() => {
    if (comparisonData.length === 0) {
      return { sector1Distance: null, sector2Distance: null };
    }

    const maxDist = comparisonData[comparisonData.length - 1].lap_distance;
    const lapObj = (lapAObj?.sector1_ms && lapAObj?.sector2_ms)
      ? lapAObj
      : ((lapBObj?.sector1_ms && lapBObj?.sector2_ms) ? lapBObj : null);

    if (lapObj && lapObj.sector1_ms && lapObj.sector2_ms) {
      const s1Time = lapObj.sector1_ms / 1000;
      const s2Time = (lapObj.sector1_ms + lapObj.sector2_ms) / 1000;
      const useTimeA = lapObj === lapAObj;

      let s1Dist: number | null = null;
      let s2Dist: number | null = null;

      for (const p of comparisonData) {
        const timeVal = useTimeA ? p.timeA : p.timeB;
        if (timeVal !== null) {
          if (s1Dist === null && timeVal >= s1Time) {
            s1Dist = p.lap_distance;
          }
          if (s2Dist === null && timeVal >= s2Time) {
            s2Dist = p.lap_distance;
          }
        }
      }

      return {
        sector1Distance: s1Dist ?? maxDist / 3,
        sector2Distance: s2Dist ?? (maxDist * 2) / 3,
      };
    }

    return {
      sector1Distance: maxDist / 3,
      sector2Distance: (maxDist * 2) / 3,
    };
  }, [comparisonData, lapAObj, lapBObj]);

  const selectedSessionObj = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId]
  );

  // Telemetry summary context for AI Race Engineer
  const telemetryContext = useMemo(() => {
    return buildTelemetryContext(
      selectedSessionObj?.track_name || '',
      selectedSessionObj?.session_type || '',
      lapAObj,
      lapBObj,
      nameA,
      nameB,
      comparisonData,
      zoomDomain
    );
  }, [selectedSessionObj, lapAObj, lapBObj, nameA, nameB, comparisonData, zoomDomain]);

  // Overall time delta calculation
  const totalDeltaMs = useMemo(() => {
    if (!lapAObj?.lap_time_ms || !lapBObj?.lap_time_ms) return null;
    return lapAObj.lap_time_ms - lapBObj.lap_time_ms;
  }, [lapAObj, lapBObj]);

  // Sector time deltas (A vs B)
  const s1Delta = useMemo(() => {
    if (lapAObj?.sector1_ms && lapBObj?.sector1_ms) {
      return lapAObj.sector1_ms - lapBObj.sector1_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  const s2Delta = useMemo(() => {
    if (lapAObj?.sector2_ms && lapBObj?.sector2_ms) {
      return lapAObj.sector2_ms - lapBObj.sector2_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  const s3Delta = useMemo(() => {
    if (lapAObj?.sector3_ms && lapBObj?.sector3_ms) {
      return lapAObj.sector3_ms - lapBObj.sector3_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  // Active participants with recorded laps and personal best times
  const activeParticipants = useMemo(() => {
    if (participants.length === 0 || laps.length === 0) return [];
    return participants
      .filter((p) => laps.some((l) => (l.car_index ?? -1) === p.car_index))
      .map((p) => {
        const driverLaps = laps
          .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0)
          .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
        const bestLap = driverLaps.length > 0 ? driverLaps[0] : null;
        return { ...p, bestLap };
      });
  }, [participants, laps]);

  // Quick select best valid lap for driver
  const selectFastestLap = (carIdx: number, target: 'A' | 'B') => {
    const driverLaps = laps
      .filter((l) => (l.car_index ?? -1) === carIdx && l.is_valid && l.lap_time_ms > 0)
      .sort((a, b) => a.lap_time_ms - b.lap_time_ms);

    if (driverLaps.length > 0) {
      if (target === 'A') setLapAId(driverLaps[0].id);
      else setLapBId(driverLaps[0].id);
    }
  };

  const renderLapSelectOptions = () => {
    if (participants.length === 0) {
      return laps.map((l) => (
        <option key={l.id} value={l.id}>
          Lap {l.lap_number} ({formatTime(l.lap_time_ms)})
        </option>
      ));
    }

    const carIndicesWithLaps = Array.from(new Set(laps.map((l) => l.car_index ?? -1)));

    return carIndicesWithLaps.map((carIdx) => {
      const p = participants.find((part) => part.car_index === carIdx);
      const groupLabel = p
        ? `${p.name}${p.race_number !== undefined ? ` (#${p.race_number})` : ''}`
        : `Car ${carIdx}`;

      const driverLaps = laps.filter((l) => (l.car_index ?? -1) === carIdx);

      return (
        <optgroup key={carIdx} label={groupLabel}>
          {driverLaps.map((l) => (
            <option key={l.id} value={l.id}>
              {p ? `#${p.race_number} ${p.name} • ` : ''}Lap {l.lap_number} — {formatTime(l.lap_time_ms)} {!l.is_valid ? '⚠️ Invalid' : ''}
            </option>
          ))}
        </optgroup>
      );
    });
  };

  // Recharts hover crosshair handler
  const handleMouseMove = useCallback((state: any) => {
    if (!state) {
      setHoverDistance(null);
      return;
    }

    let dist: number | null = null;

    if (state.activeLabel !== undefined && state.activeLabel !== null) {
      const num = Number(state.activeLabel);
      if (!isNaN(num)) {
        dist = num;
      }
    }

    if (dist === null && state.activePayload && state.activePayload.length > 0) {
      const p = state.activePayload[0]?.payload?.lap_distance;
      if (typeof p === 'number') {
        dist = p;
      }
    }

    setHoverDistance(dist);
  }, []);

  return (
    <div className="dashboard-grid" style={{ paddingTop: 0 }}>
      {/* Header Controls Panel */}
      <div className="glass-panel" style={{ gridColumn: 'span 12', padding: '1.25rem 1.5rem' }}>
        {/* Top Header Row: Title & Subtitle + Live Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              <Gauge color="var(--accent-primary)" size={26} /> Lap Comparator
            </h2>
            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Analyze time deltas, braking points, throttle application & setups
            </p>
          </div>

          {/* Live Session & Lap Delta Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {selectedSessionObj && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <MapPin size={14} color="var(--accent-primary)" />
                <span>{selectedSessionObj.track_name}</span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span style={{ color: 'var(--text-secondary)' }}>{selectedSessionObj.session_type}</span>
              </div>
            )}

            {lapAObj && lapBObj && totalDeltaMs !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: totalDeltaMs < 0 ? 'rgba(255, 71, 87, 0.15)' : totalDeltaMs > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : 'rgba(255, 255, 255, 0.2)'}`,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : '#fff',
                }}
              >
                <Timer size={14} />
                <span>
                  {totalDeltaMs < 0
                    ? `Δ -${(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s (Lap A)`
                    : totalDeltaMs > 0
                    ? `Δ -${(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s (Lap B)`
                    : 'Identical Laps'}
                </span>
              </div>
            )}

            {lapAObj && lapBObj && (
              <button
                type="button"
                onClick={() => {
                  const temp = lapAId;
                  setLapAId(lapBId);
                  setLapBId(temp);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Swap Lap A and Lap B"
              >
                <ArrowLeftRight size={13} /> Swap
              </button>
            )}

            {(lapAId || lapBId) && (
              <button
                type="button"
                onClick={() => {
                  setLapAId('');
                  setLapBId('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 71, 87, 0.1)',
                  border: '1px solid rgba(255, 71, 87, 0.3)',
                  color: '#ff4757',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Clear Lap Selections"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Middle Row: 3 Equal-Width Selector Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Session Selector */}
          <div>
            <label className="readout-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
              <Activity size={13} color="var(--accent-primary)" /> Session
            </label>
            <select
              className="ui-select"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(Number(e.target.value) || '')}
            >
              <option value="">Select Session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.track_name} - {s.session_type} ({new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          {/* Lap A Selector */}
          <div>
            <label className="readout-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#ff4757', fontWeight: 'bold' }}>●</span> Lap A (Red Solid)
              </span>
              {driverA && (
                <span
                  title={`#${driverA.race_number} ${driverA.name}`}
                  style={{
                    fontSize: '0.75rem',
                    color: '#ff4757',
                    fontWeight: 600,
                    textTransform: 'none',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}
                >
                  #{driverA.race_number} {driverA.name}
                </span>
              )}
            </label>
            <select
              className="ui-select"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={lapAId}
              onChange={(e) => setLapAId(Number(e.target.value) || '')}
              disabled={!selectedSessionId}
            >
              <option value="">Select Lap A...</option>
              {renderLapSelectOptions()}
            </select>
          </div>

          {/* Lap B Selector */}
          <div>
            <label className="readout-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: '#00d2d3', fontWeight: 'bold' }}>●</span> Lap B (Cyan Dashed)
              </span>
              {driverB && (
                <span
                  title={`#${driverB.race_number} ${driverB.name}`}
                  style={{
                    fontSize: '0.75rem',
                    color: '#00d2d3',
                    fontWeight: 600,
                    textTransform: 'none',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}
                >
                  #{driverB.race_number} {driverB.name}
                </span>
              )}
            </label>
            <select
              className="ui-select"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={lapBId}
              onChange={(e) => setLapBId(Number(e.target.value) || '')}
              disabled={!selectedSessionId}
            >
              <option value="">Select Lap B...</option>
              {renderLapSelectOptions()}
            </select>
          </div>
        </div>

        {/* Bottom Detailed Telemetry Summary & Sector Deltas Bar */}
        {(lapAObj || lapBObj) && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Left: Selected Laps Summary Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {lapAObj && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4757', display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: '#fff' }}>Lap A:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#ff4757', fontWeight: 700 }}>{formatTime(lapAObj.lap_time_ms)}</span>
                  {driverA && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({driverA.name})</span>}
                  {lapAObj.max_speed_kmh && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', color: '#ff4757', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {Math.round(lapAObj.max_speed_kmh)} km/h
                    </span>
                  )}
                  {!lapAObj.is_valid && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Invalid
                    </span>
                  )}
                </div>
              )}

              {lapAObj && lapBObj && <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />}

              {lapBObj && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d2d3', display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: '#fff' }}>Lap B:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#00d2d3', fontWeight: 700 }}>{formatTime(lapBObj.lap_time_ms)}</span>
                  {driverB && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({driverB.name})</span>}
                  {lapBObj.max_speed_kmh && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {Math.round(lapBObj.max_speed_kmh)} km/h
                    </span>
                  )}
                  {!lapBObj.is_valid && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Invalid
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Sector Deltas Chips (S1, S2, S3) */}
            {lapAObj && lapBObj && (s1Delta !== null || s2Delta !== null || s3Delta !== null) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sectors (Δ A vs B):</span>
                {s1Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s1Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s1Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s1Delta < 0 ? '#ff4757' : s1Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S1: {s1Delta <= 0 ? '' : '+'}{(s1Delta / 1000).toFixed(3)}s
                  </span>
                )}
                {s2Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s2Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s2Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s2Delta < 0 ? '#ff4757' : s2Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S2: {s2Delta <= 0 ? '' : '+'}{(s2Delta / 1000).toFixed(3)}s
                  </span>
                )}
                {s3Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s3Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s3Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s3Delta < 0 ? '#ff4757' : s3Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S3: {s3Delta <= 0 ? '' : '+'}{(s3Delta / 1000).toFixed(3)}s
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Select Driver Best Lap Bar */}
      {selectedSessionId !== '' && activeParticipants.length > 0 && (
        <div className="glass-panel" style={{ gridColumn: 'span 12', padding: '0.75rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Zap size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Select Driver Best Laps ({activeParticipants.length}):
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '0.6rem',
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '0.2rem',
            }}
          >
            {activeParticipants.map((p) => (
              <div
                key={p.car_index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1, paddingRight: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      maxWidth: '170px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={`#${p.race_number} ${p.name}`}
                  >
                    #{p.race_number} {p.name}
                  </span>
                  {p.bestLap && (
                    <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600, flexShrink: 0 }}>
                      {formatTime(p.bestLap.lap_time_ms)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => selectFastestLap(p.car_index, 'A')}
                    style={{
                      background: 'rgba(255, 71, 87, 0.15)',
                      border: '1px solid rgba(255, 71, 87, 0.6)',
                      color: '#ff4757',
                      borderRadius: '4px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.73rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title={`Set Lap A to ${p.name}'s fastest lap`}
                  >
                    Set A
                  </button>
                  <button
                    type="button"
                    onClick={() => selectFastestLap(p.car_index, 'B')}
                    style={{
                      background: 'rgba(0, 210, 211, 0.15)',
                      border: '1px solid rgba(0, 210, 211, 0.6)',
                      color: '#00d2d3',
                      borderRadius: '4px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.73rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title={`Set Lap B to ${p.name}'s fastest lap`}
                  >
                    Set B
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Cursor Point Info memoization */}
      {/* 2-COLUMN MAIN COMPARISON LAYOUT */}
      {selectedSessionId !== '' && (lapAObj || lapBObj) && (
        <div className="comparator-layout" style={{ gridColumn: 'span 12' }}>
          {/* LEFT COLUMN: Summary cards & Telemetry Charts Stack */}
          <div className="comparator-charts-col">
            {/* Summary Banner if both laps selected */}
            {lapAObj && lapBObj && totalDeltaMs !== null && (
              <div
                className="glass-panel"
                style={{
                  padding: '0.75rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: totalDeltaMs < 0 ? 'rgba(255, 71, 87, 0.12)' : totalDeltaMs > 0 ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${totalDeltaMs < 0 ? 'rgba(255, 71, 87, 0.35)' : totalDeltaMs > 0 ? 'rgba(0, 210, 211, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Award color={totalDeltaMs < 0 ? '#ff4757' : '#00d2d3'} size={24} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
                      {totalDeltaMs < 0 ? (
                        <>Lap A is <span style={{ color: '#ff4757' }}>{(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s faster</span> than Lap B</>
                      ) : totalDeltaMs > 0 ? (
                        <>Lap B is <span style={{ color: '#00d2d3' }}>{(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s faster</span> than Lap A</>
                      ) : (
                        <>Identical lap times</>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {nameA} ({formatTime(lapAObj.lap_time_ms)}) vs {nameB} ({formatTime(lapBObj.lap_time_ms)})
                    </span>
                  </div>
                </div>

                {/* Quick Sector Delta Badges */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <SectorDeltaBadge label="S1 Delta" msA={lapAObj.sector1_ms} msB={lapBObj.sector1_ms} />
                  <SectorDeltaBadge label="S2 Delta" msA={lapAObj.sector2_ms} msB={lapBObj.sector2_ms} />
                  <SectorDeltaBadge label="S3 Delta" msA={lapAObj.sector3_ms} msB={lapBObj.sector3_ms} />
                </div>
              </div>
            )}

            {/* Driver Summary Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {/* Lap A Card */}
              <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ● {nameA}
                </h3>
                {lapAObj ? (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {formatTime(lapAObj.lap_time_ms)}
                      {!lapAObj.is_valid && <span style={{ fontSize: '0.75rem', color: '#ff4757', marginLeft: '0.5rem' }}>⚠️ INVALID</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Driver: <strong style={{ color: '#fff' }}>{driverA?.name || `Car ${lapAObj.car_index ?? '?'}`}</strong> #{driverA?.race_number ?? ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S1</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector1_ms)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S2</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector2_ms)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S3</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapAObj.sector3_ms)}</div>
                      </div>
                    </div>

                    {setupA && driverA && (
                      <button
                        type="button"
                        onClick={() => setActiveSetupParticipant({ participant: driverA, setup: setupA })}
                        style={{
                          marginTop: '0.5rem',
                          background: 'rgba(255, 71, 87, 0.15)',
                          border: '1px solid rgba(255, 71, 87, 0.35)',
                          color: '#ff4757',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Sliders size={14} /> Inspect Setup A
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>No Lap A selected</p>
                )}
              </div>

              {/* Lap B Card */}
              <div className="glass-panel comparator-card-panel" style={{ padding: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ● {nameB}
                </h3>
                {lapBObj ? (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {formatTime(lapBObj.lap_time_ms)}
                      {!lapBObj.is_valid && <span style={{ fontSize: '0.75rem', color: '#ff4757', marginLeft: '0.5rem' }}>⚠️ INVALID</span>}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Driver: <strong style={{ color: '#fff' }}>{driverB?.name || `Car ${lapBObj.car_index ?? '?'}`}</strong> #{driverB?.race_number ?? ''}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S1</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector1_ms)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S2</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector2_ms)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>S3</span>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatTime(lapBObj.sector3_ms)}</div>
                      </div>
                    </div>

                    {setupB && driverB && (
                      <button
                        type="button"
                        onClick={() => setActiveSetupParticipant({ participant: driverB, setup: setupB })}
                        style={{
                          marginTop: '0.5rem',
                          background: 'rgba(0, 210, 211, 0.15)',
                          border: '1px solid rgba(0, 210, 211, 0.35)',
                          color: '#00d2d3',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Sliders size={14} /> Inspect Setup B
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1rem' }}>No Lap B selected</p>
                )}
              </div>
            </div>

            {/* Synchronized Track Distance Zoom Toolbar */}
            {comparisonData.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 1rem',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                  <ZoomIn size={16} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Track Distance Zoom:</span>
                  <button
                    type="button"
                    onClick={() => setZoomDomain(null)}
                    style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      border: !zoomDomain ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                      background: !zoomDomain ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: !zoomDomain ? '#ff4757' : '#ccc',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Full Track
                  </button>
                  {sector1Distance !== null && (
                    <button
                      type="button"
                      onClick={() => setZoomDomain([0, sector1Distance])}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(243, 156, 18, 0.4)',
                        background: 'rgba(243, 156, 18, 0.12)',
                        color: '#f39c12',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Sector 1
                    </button>
                  )}
                  {sector1Distance !== null && sector2Distance !== null && (
                    <button
                      type="button"
                      onClick={() => setZoomDomain([sector1Distance, sector2Distance])}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(155, 89, 182, 0.4)',
                        background: 'rgba(155, 89, 182, 0.12)',
                        color: '#9b59b6',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Sector 2
                    </button>
                  )}
                  {sector2Distance !== null && comparisonData.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setZoomDomain([sector2Distance, comparisonData[comparisonData.length - 1].lap_distance])}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(0, 210, 211, 0.4)',
                        background: 'rgba(0, 210, 211, 0.12)',
                        color: '#00d2d3',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Sector 3
                    </button>
                  )}
                </div>

                {zoomDomain && (
                  <button
                    type="button"
                    onClick={() => setZoomDomain(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={12} /> Reset Zoom ({Math.round(zoomDomain[0])}m - {Math.round(zoomDomain[1])}m)
                  </button>
                )}
              </div>
            )}

            {/* TELEMETRY CHARTS STACK */}
            {comparisonData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. TIME DELTA CHART (MOST IMPORTANT) */}
                <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      ⏱️ Time Delta (s)
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Below 0s = {nameA} Ahead | Above 0s = {nameB} Ahead
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}s`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                          formatter={(val: any) => [`${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(3)}s`, `Time Delta (${nameA} vs ${nameB})`]}
                        />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="time_delta" name="Time Delta" stroke="#f1c40f" dot={false} strokeWidth={2.5} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. SPEED CHART */}
                <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>🏎️ Speed (KM/H)</h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[0, 360]} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="speedA" name={`${nameA} Speed (km/h)`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="speedB" name={`${nameB} Speed (km/h)`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. INDIVIDUAL THROTTLE CHART */}
                <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🟢 Throttle Application (%)
                  </h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} formatter={(val: any) => [`${Math.round(Number(val) * 100)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="throttleA" name={`${nameA} Throttle`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="throttleB" name={`${nameB} Throttle`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. INDIVIDUAL BRAKE CHART */}
                <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🔴 Brake Pressure (%)
                  </h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} formatter={(val: any) => [`${Math.round(Number(val) * 100)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="brakeA" name={`${nameA} Brake`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="brakeB" name={`${nameB} Brake`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5. GEAR SELECTION CHART */}
                <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>⚙️ Gear Selection (1 - 8)</h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[1, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="stepAfter" dataKey="gearA" name={`${nameA} Gear`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="gearB" name={`${nameB} Gear`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 6. STEERING ANGLE CHART */}
                <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#fff' }}>📐 Steering Angle</h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[-1, 1]} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="steerA" name={`${nameA} Steer`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="steerB" name={`${nameB} Steer`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 7. INDIVIDUAL ERS BATTERY CHART */}
                <div className="glass-panel" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem', color: '#38ef7d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    ⚡ ERS Battery Store (%)
                  </h3>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }} formatter={(val: any) => [`${Number(val).toFixed(1)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="monotone" dataKey="ersBatteryA" name={`${nameA} Battery (%)`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="monotone" dataKey="ersBatteryB" name={`${nameB} Battery (%)`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 8. INDIVIDUAL ERS DEPLOY MODE CHART */}
                <div className="glass-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#bd93f9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🚀 ERS Deploy Mode
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      0: Off | 1: Medium | 2: Hotlap | 3: Overtake
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} syncId="comparatorSync" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverDistance(null)} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="lap_distance" type="number" domain={['dataMin', 'dataMax']} allowDataOverflow={true} stroke="#666" tick={{ fill: '#999', fontSize: 11 }} unit="m" />
                        <YAxis stroke="#bd93f9" tick={{ fill: '#bd93f9', fontSize: 11 }} domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(v) => ERS_MODE_NAMES[v] || `${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: '6px' }}
                          formatter={(val: any, name?: any) => {
                            const modeNum = Math.round(Number(val));
                            return [ERS_MODE_NAMES[modeNum] || `Mode ${modeNum}`, String(name ?? '')];
                          }}
                        />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="stepAfter" dataKey="ersDeployModeA" name={`${nameA} ERS Mode`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="ersDeployModeB" name={`${nameB} ERS Mode`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
                  {!selectedSessionId
                    ? 'Select a session and two laps above to compare telemetry.'
                    : loadingA || loadingB
                    ? 'Loading telemetry data...'
                    : 'Select Lap A and Lap B to generate comparison charts.'}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Sticky Track Map Sidebar */}
          {comparisonData.length > 0 && (
            <div className="comparator-sidebar-col">
              <div className="glass-panel" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={16} color="var(--accent-primary)" /> Track Heatmap
                  </h4>
                  {selectedSessionObj && (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {selectedSessionObj.track_name}
                    </span>
                  )}
                </div>

                <ComparatorTrackMap
                  data={comparisonData}
                  activeDistance={hoverDistance}
                  height={360}
                  sector1Distance={sector1Distance}
                  sector2Distance={sector2Distance}
                />

                {/* Active Hover Point Live Telemetry Readout */}
                {hoverDistance !== null && comparisonData.length > 0 && (() => {
                  const activePoint = comparisonData.reduce((prev, curr) =>
                    Math.abs(curr.lap_distance - hoverDistance) < Math.abs(prev.lap_distance - hoverDistance) ? curr : prev
                  , comparisonData[0]);

                  if (!activePoint) return null;

                  return (
                    <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem', marginBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Distance Point:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f1c40f' }}>{activePoint.lap_distance}m</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.35rem' }}>
                        <div style={{ borderLeft: '2px solid #ff4757', paddingLeft: '0.4rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#ff4757', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</div>
                          <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedA ?? '-'} km/h</strong></div>
                          <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleA !== null ? Math.round(activePoint.throttleA * 100) : 0}% / {activePoint.brakeA !== null ? Math.round(activePoint.brakeA * 100) : 0}%</strong></div>
                          <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryA !== null ? activePoint.ersBatteryA.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeA ?? 0] || 'Off'})</strong></div>
                        </div>

                        <div style={{ borderLeft: '2px solid #00d2d3', paddingLeft: '0.4rem' }}>
                          <div style={{ fontSize: '0.72rem', color: '#00d2d3', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</div>
                          <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedB ?? '-'} km/h</strong></div>
                          <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleB !== null ? Math.round(activePoint.throttleB * 100) : 0}% / {activePoint.brakeB !== null ? Math.round(activePoint.brakeB * 100) : 0}%</strong></div>
                          <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryB !== null ? activePoint.ersBatteryB.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeB ?? 0] || 'Off'})</strong></div>
                        </div>
                      </div>

                      {activePoint.time_delta !== null && (
                        <div style={{ marginTop: '0.4rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontWeight: 700, color: activePoint.time_delta < 0 ? '#ff4757' : activePoint.time_delta > 0 ? '#00d2d3' : '#fff' }}>
                          Δ {activePoint.time_delta > 0 ? '+' : ''}{activePoint.time_delta.toFixed(3)}s
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* AI Race Engineer Integrated Card below Track Map */}
              <AiRaceEngineer
                telemetryContext={telemetryContext}
                hasLapsSelected={Boolean(lapAId && lapBId && lapAObj && lapBObj)}
                isZoomActive={Boolean(zoomDomain)}
              />
            </div>
          )}
        </div>
      )}

      {/* Car Setup Inspector Modal Overlay */}
      {activeSetupParticipant && (
        <CarSetupModal participant={activeSetupParticipant.participant} setup={activeSetupParticipant.setup} onClose={() => setActiveSetupParticipant(null)} />
      )}
    </div>
  );
};

// Helper component for sector delta display
const SectorDeltaBadge: React.FC<{ label: string; msA?: number; msB?: number }> = ({ label, msA, msB }) => {
  if (!msA || !msB) return null;
  const deltaMs = msA - msB;
  const isFaster = deltaMs < 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem 0.6rem', borderRadius: '4px' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{label}:</span>
      <span style={{ fontWeight: 'bold', fontFamily: 'var(--font-mono)', color: isFaster ? '#ff4757' : deltaMs > 0 ? '#00d2d3' : '#fff' }}>
        {deltaMs > 0 ? '+' : ''}{(deltaMs / 1000).toFixed(3)}s
      </span>
      {isFaster ? <ArrowUpRight size={14} color="#ff4757" /> : deltaMs > 0 ? <ArrowDownRight size={14} color="#00d2d3" /> : null}
    </div>
  );
};

// Car Setup Modal
const CarSetupModal: React.FC<{ participant: Participant; setup: CarSetup; onClose: () => void }> = ({ participant, setup, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '850px',
          width: '100%',
          background: 'rgba(18, 18, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: '#fff' }}>
              <Sliders size={20} color="#00f2fe" /> Setup Details — {participant.name} (#{participant.race_number})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Car #{participant.car_index + 1} • Team ID {participant.team_id}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              <Shield size={14} color="#38ef7d" /> Aero & Weight
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Front Wing</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.front_wing}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rear Wing</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.rear_wing}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Fuel size={12} /> Fuel Load
                </span>
                <span className="mono" style={{ fontWeight: 600, color: '#38ef7d' }}>{setup.fuel_load ? setup.fuel_load.toFixed(1) : '0.0'} kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ballast</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.ballast}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              <Disc size={14} color="#ff4e50" /> Transmission & Brakes
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Diff On-Throttle</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.on_throttle}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Diff Off-Throttle</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.off_throttle}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Brake Pressure</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.brake_pressure}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Brake Bias</span>
                <span className="mono" style={{ fontWeight: 600, color: '#ff4e50' }}>{setup.brake_bias}%</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              <Wrench size={14} color="#f8d030" /> Suspension & ARB
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Suspension</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.front_suspension} / {setup.rear_suspension}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Anti-Roll Bar</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.front_anti_roll_bar} / {setup.rear_anti_roll_bar}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Ride Height</span>
                <span className="mono" style={{ fontWeight: 600 }}>{setup.front_suspension_height} / {setup.rear_suspension_height}</span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
              <CircleDot size={14} color="#00f2fe" /> Geometry & Tyres
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Camber</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {setup.front_camber ? setup.front_camber.toFixed(2) : '0.00'}° / {setup.rear_camber ? setup.rear_camber.toFixed(2) : '0.00'}°
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Toe</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {setup.front_toe ? setup.front_toe.toFixed(2) : '0.00'}° / {setup.rear_toe ? setup.rear_toe.toFixed(2) : '0.00'}°
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>F / R Tyre PSI</span>
                <span className="mono" style={{ fontWeight: 600, color: '#00f2fe' }}>
                  {setup.front_tyre_pressure ? setup.front_tyre_pressure.toFixed(1) : '0.0'} / {setup.rear_tyre_pressure ? setup.rear_tyre_pressure.toFixed(1) : '0.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to format ms into M:SS.ms
function formatTime(ms?: number) {
  if (!ms) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const m = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, '0')}.${m.toString().padStart(3, '0')}`;
}
