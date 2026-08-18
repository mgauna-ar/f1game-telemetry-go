import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  Gauge,
  MapPin,
  Timer,
  ArrowLeftRight,
  Zap,
  Link,
  Unlink,
  Sparkles,
} from 'lucide-react';

import type { Session, Participant, Lap, NavigationComparatorPayload } from '../types/session';
import { lttbDownsample } from '../utils/downsample';
import type { TelemetrySamplePoint } from '../utils/downsample';
import { calculateMergedComparison } from '../utils/deltaCalculation';
import type { MergedTelemetryPoint } from '../utils/deltaCalculation';
import { buildTelemetryContext } from '../utils/aiTelemetrySummary';
import { detectTrackTurns, getTurnContextAtDistance } from '../utils/trackTurns';
import { ComparatorTrackMap } from './ComparatorTrackMap';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import { ERS_MODE_NAMES, TELEMETRY_DOWNSAMPLE_LIMITS } from '../constants/f1';
import { formatTime } from '../utils/formatters';

import { SlotCard } from './lap_comparator/SlotCard';
import { QuickSelectLeaderboard } from './lap_comparator/QuickSelectLeaderboard';
import { ComparatorMetricsSummary } from './lap_comparator/ComparatorMetricsSummary';
import { ComparatorTelemetryCharts } from './lap_comparator/ComparatorTelemetryCharts';

export interface LapComparatorProps {
  initialPreload?: NavigationComparatorPayload | null;
}

export const LapComparator: React.FC<LapComparatorProps> = ({ initialPreload }) => {
  const { t } = useI18n();
  const { setComparatorContext, setContextMode, openChat } = useRaceEngineer();
  const [sessions, setSessions] = useState<Session[]>([]);

  // Dual session IDs & Synchronization link
  const [sessionAId, setSessionAId] = useState<number | ''>(() => {
    if (initialPreload?.sessionAId) return initialPreload.sessionAId;
    if (initialPreload?.sessionId && (!initialPreload?.slot || initialPreload?.slot === 'A')) return initialPreload.sessionId;
    return '';
  });

  const [sessionBId, setSessionBId] = useState<number | ''>(() => {
    if (initialPreload?.sessionBId) return initialPreload.sessionBId;
    if (initialPreload?.sessionId && initialPreload?.slot === 'B') return initialPreload.sessionId;
    if (initialPreload?.sessionAId) return initialPreload.sessionAId;
    if (initialPreload?.sessionId) return initialPreload.sessionId;
    return '';
  });

  const [isLinkedSessions, setIsLinkedSessions] = useState(true);

  // Dropdown UI states
  const [isSessionADropdownOpen, setIsSessionADropdownOpen] = useState(false);
  const [sessionASearchQuery, setSessionASearchQuery] = useState('');
  const [sessionATypeTab, setSessionATypeTab] = useState<'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE'>('ALL');
  const sessionADropdownRef = useRef<HTMLDivElement>(null);

  const [isSessionBDropdownOpen, setIsSessionBDropdownOpen] = useState(false);
  const [sessionBSearchQuery, setSessionBSearchQuery] = useState('');
  const [sessionBTypeTab, setSessionBTypeTab] = useState<'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE'>('ALL');
  const sessionBDropdownRef = useRef<HTMLDivElement>(null);

  // Slot A Data
  const [lapsA, setLapsA] = useState<Lap[]>([]);
  const [participantsA, setParticipantsA] = useState<Participant[]>([]);
  const [lapAId, setLapAId] = useState<number | ''>('');
  const [rawTelemetryA, setRawTelemetryA] = useState<TelemetrySamplePoint[]>([]);
  const [loadingA, setLoadingA] = useState(false);

  // Slot B Data
  const [lapsB, setLapsB] = useState<Lap[]>([]);
  const [participantsB, setParticipantsB] = useState<Participant[]>([]);
  const [lapBId, setLapBId] = useState<number | ''>('');
  const [rawTelemetryB, setRawTelemetryB] = useState<TelemetrySamplePoint[]>([]);
  const [loadingB, setLoadingB] = useState(false);

  // Inspection & Zoom state
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // Quick Select Leaderboard State
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('f1_comparator_quick_select_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
  const [quickSelectSessionTab, setQuickSelectSessionTab] = useState<'ALL' | 'A' | 'B'>('ALL');

  useEffect(() => {
    try {
      localStorage.setItem('f1_comparator_quick_select_open', String(isQuickSelectOpen));
    } catch {
      // ignore localStorage write errors
    }
  }, [isQuickSelectOpen]);

  // Fetch available sessions
  const fetchSessions = useCallback(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => {
        const sessionList = data || [];
        setSessions(sessionList);
      })
      .catch((err) => console.error('Failed to fetch sessions', err));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Handle Session A Selection
  const handleSelectSessionA = (sessionId: number) => {
    setSessionAId(sessionId);
    setLapAId('');
    setIsSessionADropdownOpen(false);
    if (isLinkedSessions) {
      setSessionBId(sessionId);
      setLapBId('');
    } else {
      const newSessionA = sessions.find((s) => s.id === sessionId);
      const currentSessionB = sessions.find((s) => s.id === sessionBId);
      if (newSessionA && currentSessionB && newSessionA.track_name.toLowerCase() !== currentSessionB.track_name.toLowerCase()) {
        setSessionBId(sessionId);
        setLapBId('');
      }
    }
  };

  // Handle Session B Selection
  const handleSelectSessionB = (sessionId: number) => {
    setSessionBId(sessionId);
    setLapBId('');
    setIsSessionBDropdownOpen(false);
    if (isLinkedSessions && sessionId !== sessionAId) {
      setIsLinkedSessions(false);
    }
  };

  // Toggle Linked Sessions
  const toggleSessionLink = () => {
    if (!isLinkedSessions) {
      setIsLinkedSessions(true);
      setSessionBId(sessionAId);
      setLapBId('');
    } else {
      setIsLinkedSessions(false);
    }
  };

  // Load Session A details (participants, laps)
  useEffect(() => {
    if (sessionAId !== '') {
      fetch(`/api/sessions/${sessionAId}/participants`)
        .then((res) => res.json())
        .then((data) => setParticipantsA(data || []))
        .catch((err) => console.error('Failed to fetch participants A', err));

      fetch(`/api/sessions/${sessionAId}/laps`)
        .then((res) => res.json())
        .then((data) => {
          const list: Lap[] = data || [];
          setLapsA(list);

          const preloadedLapAId = initialPreload?.lapAId || (initialPreload?.slot === 'A' ? initialPreload?.lapId : undefined);
          if (preloadedLapAId && list.some((l) => l.id === preloadedLapAId)) {
            setLapAId(preloadedLapAId);
          } else if (list.length > 0) {
            const valid = list.filter((l) => l.is_valid && l.lap_time_ms > 0).sort((a, b) => a.lap_time_ms - b.lap_time_ms);
            const best = valid.length > 0 ? valid[0] : list[0];
            setLapAId(best.id);
          } else {
            setLapAId('');
          }
        })
        .catch((err) => console.error('Failed to fetch laps A', err));
    }
  }, [sessionAId, initialPreload]);

  // Load Session B details (participants, laps)
  useEffect(() => {
    if (sessionBId !== '') {
      fetch(`/api/sessions/${sessionBId}/participants`)
        .then((res) => res.json())
        .then((data) => setParticipantsB(data || []))
        .catch((err) => console.error('Failed to fetch participants B', err));

      fetch(`/api/sessions/${sessionBId}/laps`)
        .then((res) => res.json())
        .then((data) => {
          const list: Lap[] = data || [];
          setLapsB(list);

          const preloadedLapBId = initialPreload?.lapBId || (initialPreload?.slot === 'B' ? initialPreload?.lapId : undefined);
          if (preloadedLapBId && list.some((l) => l.id === preloadedLapBId)) {
            setLapBId(preloadedLapBId);
          } else if (list.length > 0) {
            const valid = list.filter((l) => l.is_valid && l.lap_time_ms > 0).sort((a, b) => a.lap_time_ms - b.lap_time_ms);
            if (valid.length > 1 && sessionAId === sessionBId) {
              setLapBId(valid[1].id);
            } else if (valid.length > 0) {
              const best = valid.length > 0 ? valid[0] : list[0];
              setLapBId(best.id);
            } else {
              setLapBId(list[0].id);
            }
          } else {
            setLapBId('');
          }
        })
        .catch((err) => console.error('Failed to fetch laps B', err));
    }
  }, [sessionBId, sessionAId, initialPreload]);

  // Load Lap A Telemetry (Server-side LTTB downsampled with ?maxPoints=800)
  useEffect(() => {
    if (lapAId !== '') {
      setLoadingA(true);
      fetch(`/api/laps/${lapAId}/telemetry?maxPoints=${TELEMETRY_DOWNSAMPLE_LIMITS.DEFAULT_MAX_POINTS}`)
        .then((res) => res.json())
        .then((data) => {
          const samples: TelemetrySamplePoint[] = data || [];
          setRawTelemetryA(samples.length > TELEMETRY_DOWNSAMPLE_LIMITS.BUFFER_THRESHOLD ? lttbDownsample(samples, TELEMETRY_DOWNSAMPLE_LIMITS.DEFAULT_MAX_POINTS) : samples);
        })
        .catch((err) => console.error('Failed to fetch telemetry A', err))
        .finally(() => setLoadingA(false));
    }
  }, [lapAId]);

  // Load Lap B Telemetry (Server-side LTTB downsampled with ?maxPoints=800)
  useEffect(() => {
    if (lapBId !== '') {
      setLoadingB(true);
      fetch(`/api/laps/${lapBId}/telemetry?maxPoints=${TELEMETRY_DOWNSAMPLE_LIMITS.DEFAULT_MAX_POINTS}`)
        .then((res) => res.json())
        .then((data) => {
          const samples: TelemetrySamplePoint[] = data || [];
          setRawTelemetryB(samples.length > TELEMETRY_DOWNSAMPLE_LIMITS.BUFFER_THRESHOLD ? lttbDownsample(samples, TELEMETRY_DOWNSAMPLE_LIMITS.DEFAULT_MAX_POINTS) : samples);
        })
        .catch((err) => console.error('Failed to fetch telemetry B', err))
        .finally(() => setLoadingB(false));
    }
  }, [lapBId]);

  // Selected session objects
  const selectedSessionAObj = useMemo(() => sessions.find((s) => s.id === sessionAId), [sessions, sessionAId]);
  const selectedSessionBObj = useMemo(() => sessions.find((s) => s.id === sessionBId), [sessions, sessionBId]);

  // Filtered Sessions for Dropdown A
  const filteredDropdownSessionsA = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        !sessionASearchQuery ||
        s.track_name.toLowerCase().includes(sessionASearchQuery.toLowerCase()) ||
        s.session_type.toLowerCase().includes(sessionASearchQuery.toLowerCase()) ||
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(sessionASearchQuery.toLowerCase()) ||
        (s.tags && s.tags.some((t) => t.name.toLowerCase().includes(sessionASearchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      if (sessionATypeTab === 'ALL') return true;
      const lower = s.session_type.toLowerCase();
      if (sessionATypeTab === 'SPRINT') return lower.includes('sprint');
      if (sessionATypeTab === 'RACE') return lower.includes('race') && !lower.includes('sprint');
      if (sessionATypeTab === 'QUALI') return (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) && !lower.includes('sprint');
      if (sessionATypeTab === 'PRACTICE') return lower.includes('practice') || lower.includes('fp') || lower.includes('p1') || lower.includes('p2') || lower.includes('p3');
      return true;
    });
  }, [sessions, sessionASearchQuery, sessionATypeTab]);

  // Filtered Sessions for Dropdown B (Strictly restricted to same circuit as Session A)
  const filteredDropdownSessionsB = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedSessionAObj && s.track_name.toLowerCase() !== selectedSessionAObj.track_name.toLowerCase()) {
        return false;
      }

      const matchesSearch =
        !sessionBSearchQuery ||
        s.track_name.toLowerCase().includes(sessionBSearchQuery.toLowerCase()) ||
        s.session_type.toLowerCase().includes(sessionBSearchQuery.toLowerCase()) ||
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(sessionBSearchQuery.toLowerCase()) ||
        (s.tags && s.tags.some((t) => t.name.toLowerCase().includes(sessionBSearchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      if (sessionBTypeTab === 'ALL') return true;
      const lower = s.session_type.toLowerCase();
      if (sessionBTypeTab === 'SPRINT') return lower.includes('sprint');
      if (sessionBTypeTab === 'RACE') return lower.includes('race') && !lower.includes('sprint');
      if (sessionBTypeTab === 'QUALI') return (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) && !lower.includes('sprint');
      if (sessionBTypeTab === 'PRACTICE') return lower.includes('practice') || lower.includes('fp') || lower.includes('p1') || lower.includes('p2') || lower.includes('p3');
      return true;
    });
  }, [sessions, selectedSessionAObj, sessionBSearchQuery, sessionBTypeTab]);

  // Click outside & Escape key listeners for session dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionADropdownRef.current && !sessionADropdownRef.current.contains(event.target as Node)) {
        setIsSessionADropdownOpen(false);
      }
      if (sessionBDropdownRef.current && !sessionBDropdownRef.current.contains(event.target as Node)) {
        setIsSessionBDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSessionADropdownOpen(false);
        setIsSessionBDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Selected lap objects
  const lapAObj = useMemo(() => lapsA.find((l) => l.id === lapAId), [lapsA, lapAId]);
  const lapBObj = useMemo(() => lapsB.find((l) => l.id === lapBId), [lapsB, lapBId]);

  // Driver details for lap A & B
  const driverA = useMemo(
    () => (lapAObj?.car_index !== undefined ? participantsA.find((p) => p.car_index === lapAObj.car_index) : undefined),
    [lapAObj, participantsA]
  );
  const driverB = useMemo(
    () => (lapBObj?.car_index !== undefined ? participantsB.find((p) => p.car_index === lapBObj.car_index) : undefined),
    [lapBObj, participantsB]
  );

  const nameA = useMemo(() => (driverA ? `#${driverA.race_number} ${driverA.name}` : 'Lap A'), [driverA]);
  const nameB = useMemo(() => (driverB ? `#${driverB.race_number} ${driverB.name}` : 'Lap B'), [driverB]);

  // Calculate high-performance merged telemetry comparison points (resampled every 5 meters)
  const comparisonData = useMemo<MergedTelemetryPoint[]>(() => {
    if (rawTelemetryA.length === 0 && rawTelemetryB.length === 0) return [];
    return calculateMergedComparison(rawTelemetryA, rawTelemetryB, 5);
  }, [rawTelemetryA, rawTelemetryB]);

  // Detected track turns and apexes
  const detectedTurns = useMemo(() => detectTrackTurns(comparisonData), [comparisonData]);

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

    const maxDist = comparisonData[comparisonData.length - 1].lap_distance || 1;
    const lapObj = (lapAObj?.sector1_ms && lapAObj?.sector2_ms)
      ? lapAObj
      : ((lapBObj?.sector1_ms && lapBObj?.sector2_ms) ? lapBObj : null);

    let calculatedS1: number | null = null;
    let calculatedS2: number | null = null;

    if (lapObj && lapObj.sector1_ms && lapObj.sector2_ms) {
      const s1Time = lapObj.sector1_ms / 1000;
      const s2Time = (lapObj.sector1_ms + lapObj.sector2_ms) / 1000;
      const useTimeA = lapObj === lapAObj;

      for (const p of comparisonData) {
        const timeVal = useTimeA ? p.timeA : p.timeB;
        if (timeVal !== null && Number.isFinite(timeVal)) {
          if (calculatedS1 === null && timeVal >= s1Time) {
            calculatedS1 = p.lap_distance;
          }
          if (calculatedS2 === null && timeVal >= s2Time) {
            calculatedS2 = p.lap_distance;
          }
        }
      }
    }

    const s1 = calculatedS1 !== null && calculatedS1 > 0 && calculatedS1 < maxDist ? calculatedS1 : Math.round((maxDist / 3) * 10) / 10;
    const s2 = calculatedS2 !== null && calculatedS2 > s1 && calculatedS2 < maxDist ? calculatedS2 : Math.round(((maxDist * 2) / 3) * 10) / 10;

    return {
      sector1Distance: s1,
      sector2Distance: s2,
    };
  }, [comparisonData, lapAObj, lapBObj]);

  // Telemetry summary context for AI Race Engineer
  const telemetryContext = useMemo(() => {
    return buildTelemetryContext(
      selectedSessionAObj?.track_name || '',
      selectedSessionAObj?.session_type || '',
      lapAObj,
      lapBObj,
      nameA,
      nameB,
      comparisonData,
      zoomDomain,
      selectedSessionBObj?.session_type || selectedSessionAObj?.session_type,
      selectedSessionAObj?.weather,
      selectedSessionBObj?.weather
    );
  }, [selectedSessionAObj, selectedSessionBObj, lapAObj, lapBObj, nameA, nameB, comparisonData, zoomDomain]);

  useEffect(() => {
    setComparatorContext(telemetryContext);
    setContextMode('comparator');
  }, [telemetryContext, setComparatorContext, setContextMode]);

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

  // Active participants for Session A with best laps
  const activeParticipantsA = useMemo(() => {
    if (participantsA.length === 0 || lapsA.length === 0) return [];
    return participantsA
      .filter((p) => lapsA.some((l) => (l.car_index ?? -1) === p.car_index))
      .map((p) => {
        const driverLaps = lapsA
          .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0)
          .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
        const bestLap = driverLaps.length > 0 ? driverLaps[0] : null;
        return { ...p, bestLap };
      });
  }, [participantsA, lapsA]);

  // Active participants for Session B with best laps
  const activeParticipantsB = useMemo(() => {
    if (participantsB.length === 0 || lapsB.length === 0) return [];
    return participantsB
      .filter((p) => lapsB.some((l) => (l.car_index ?? -1) === p.car_index))
      .map((p) => {
        const driverLaps = lapsB
          .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0)
          .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
        const bestLap = driverLaps.length > 0 ? driverLaps[0] : null;
        return { ...p, bestLap };
      });
  }, [participantsB, lapsB]);

  // Quick Select Leaderboard data computation
  const quickSelectData = useMemo(() => {
    const driversA = activeParticipantsA.map((p) => ({
      ...p,
      sessionSlot: 'A' as const,
      sessionTrack: selectedSessionAObj?.track_name,
      sessionType: selectedSessionAObj?.session_type,
    }));
    const driversB = activeParticipantsB.map((p) => ({
      ...p,
      sessionSlot: 'B' as const,
      sessionTrack: selectedSessionBObj?.track_name,
      sessionType: selectedSessionBObj?.session_type,
    }));

    let candidateList: Array<typeof driversA[0] | typeof driversB[0]>;
    if (isLinkedSessions || sessionAId === sessionBId) {
      candidateList = driversA;
    } else {
      if (quickSelectSessionTab === 'A') {
        candidateList = driversA;
      } else if (quickSelectSessionTab === 'B') {
        candidateList = driversB;
      } else {
        candidateList = [...driversA, ...driversB];
      }
    }

    const sorted = [...candidateList].sort((a, b) => {
      const timeA = a.bestLap && a.bestLap.lap_time_ms > 0 ? a.bestLap.lap_time_ms : Infinity;
      const timeB = b.bestLap && b.bestLap.lap_time_ms > 0 ? b.bestLap.lap_time_ms : Infinity;
      return timeA - timeB;
    });

    const leaderLapTimeMs = sorted.find((d) => d.bestLap && d.bestLap.lap_time_ms > 0)?.bestLap?.lap_time_ms ?? null;

    const q = driverSearchQuery.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.race_number.toString().includes(q) ||
            (d.bestLap?.tyre_compound && d.bestLap.tyre_compound.toLowerCase().includes(q))
        )
      : sorted;

    return {
      drivers: filtered,
      totalCount: sorted.length,
      leaderLapTimeMs,
    };
  }, [
    activeParticipantsA,
    activeParticipantsB,
    isLinkedSessions,
    sessionAId,
    sessionBId,
    quickSelectSessionTab,
    driverSearchQuery,
    selectedSessionAObj,
    selectedSessionBObj,
  ]);

  // Swap Slots handler
  const handleSwapSlots = () => {
    const tempSessionId = sessionAId;
    const tempLapId = lapAId;

    if (!isLinkedSessions) {
      setSessionAId(sessionBId);
      setSessionBId(tempSessionId);
    }
    setLapAId(lapBId);
    setLapBId(tempLapId);
  };

  // Clear selections
  const handleClearSelections = () => {
    setLapAId('');
    setLapBId('');
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
      <div
        className="glass-panel"
        style={{
          gridColumn: 'span 12',
          padding: '1.25rem 1.5rem',
          position: 'relative',
          zIndex: 80,
        }}
      >
        {/* Top Header Row: Title & Subtitle + Live Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              <Gauge color="var(--accent-primary)" size={26} /> {t('comparator.title')}
            </h2>
            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              {t('comparator.subtitle')}
            </p>
          </div>

          {/* Live Badges and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {selectedSessionAObj && (
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
                <span>{selectedSessionAObj.track_name}</span>
                {!isLinkedSessions && selectedSessionBObj && selectedSessionBObj.id !== selectedSessionAObj.id && (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(255, 165, 2, 0.2)', color: '#ffa502', padding: '1px 6px', borderRadius: '10px' }}>
                    {t('comparator.crossSession')}
                  </span>
                )}
              </div>
            )}

            {/* Session Link / Unlink Toggle Button */}
            {selectedSessionAObj && sessions.length > 1 && (
              <button
                type="button"
                onClick={toggleSessionLink}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: isLinkedSessions ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 165, 2, 0.15)',
                  border: `1px solid ${isLinkedSessions ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 165, 2, 0.5)'}`,
                  color: isLinkedSessions ? '#00d2d3' : '#ffa502',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={isLinkedSessions ? t('comparator.linkedTitle') : t('comparator.crossSessionTitle')}
                data-testid="session-sync-toggle"
              >
                {isLinkedSessions ? <Link size={14} /> : <Unlink size={14} />}
                <span>{isLinkedSessions ? t('comparator.linked') : t('comparator.crossSession')}</span>
              </button>
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
                    ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapA') })
                    : totalDeltaMs > 0
                    ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapB') })
                    : t('comparator.identicalLaps')}
                </span>
              </div>
            )}

            {lapAObj && lapBObj && (
              <button
                type="button"
                onClick={handleSwapSlots}
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
                title={t('comparator.swapTitle')}
              >
                <ArrowLeftRight size={13} /> {t('comparator.swap')}
              </button>
            )}

            {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
              <button
                type="button"
                onClick={() => setIsQuickSelectOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: isQuickSelectOpen ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${isQuickSelectOpen ? 'rgba(0, 210, 211, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                  color: isQuickSelectOpen ? '#00d2d3' : 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={isQuickSelectOpen ? t('comparator.collapseDrivers') : t('comparator.expandDrivers')}
                data-testid="toggle-quick-select-toolbar-btn"
              >
                <Zap size={13} color={isQuickSelectOpen ? '#00d2d3' : 'var(--accent-primary)'} />
                <span>{t('comparator.drivers', { count: quickSelectData.totalCount })}</span>
              </button>
            )}

            {(lapAId || lapBId) && (
              <button
                type="button"
                onClick={handleClearSelections}
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
                title={t('comparator.clearTitle')}
              >
                <X size={13} /> {t('comparator.clear')}
              </button>
            )}
          </div>
        </div>

        {/* SIDE-BY-SIDE COMPARISON SLOTS CONTAINER */}
        <div className="comparator-slots-container">
          {/* SLOT A CARD */}
          <SlotCard
            slot="A"
            title={t('comparator.slotABaseline')}
            accentColor="#ff4757"
            driver={driverA}
            sessions={sessions}
            filteredSessions={filteredDropdownSessionsA}
            selectedSession={selectedSessionAObj}
            isSessionDropdownOpen={isSessionADropdownOpen}
            onToggleSessionDropdown={() => setIsSessionADropdownOpen((prev) => !prev)}
            dropdownRef={sessionADropdownRef}
            sessionSearchQuery={sessionASearchQuery}
            onSessionSearchChange={setSessionASearchQuery}
            sessionTypeTab={sessionATypeTab}
            onSessionTypeTabChange={setSessionATypeTab}
            onSelectSession={handleSelectSessionA}
            laps={lapsA}
            participants={participantsA}
            selectedLapId={lapAId}
            onSelectLap={(id) => setLapAId(id)}
          />

          {/* SLOT B CARD */}
          <SlotCard
            slot="B"
            title={t('comparator.slotBComparison')}
            accentColor="#00d2d3"
            driver={driverB}
            sessions={sessions}
            filteredSessions={filteredDropdownSessionsB}
            selectedSession={selectedSessionBObj}
            isSessionDropdownOpen={isSessionBDropdownOpen}
            onToggleSessionDropdown={() => setIsSessionBDropdownOpen((prev) => !prev)}
            dropdownRef={sessionBDropdownRef}
            sessionSearchQuery={sessionBSearchQuery}
            onSessionSearchChange={setSessionBSearchQuery}
            sessionTypeTab={sessionBTypeTab}
            onSessionTypeTabChange={setSessionBTypeTab}
            onSelectSession={handleSelectSessionB}
            laps={lapsB}
            participants={participantsB}
            selectedLapId={lapBId}
            onSelectLap={(id) => setLapBId(id)}
            isRestrictedCircuit={!isLinkedSessions}
            restrictedTrackName={selectedSessionAObj?.track_name}
          />
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

      {/* Enhanced Collapsible Quick Select Driver Leaderboard */}
      {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
        <QuickSelectLeaderboard
          isOpen={isQuickSelectOpen}
          onToggleOpen={() => setIsQuickSelectOpen((prev) => !prev)}
          quickSelectData={quickSelectData}
          driverSearchQuery={driverSearchQuery}
          onDriverSearchChange={setDriverSearchQuery}
          isLinkedSessions={isLinkedSessions}
          sessionAId={sessionAId}
          sessionBId={sessionBId}
          quickSelectSessionTab={quickSelectSessionTab}
          onQuickSelectSessionTabChange={setQuickSelectSessionTab}
          lapAId={lapAId}
          lapBId={lapBId}
          lapsA={lapsA}
          lapsB={lapsB}
          onSetLapA={(id) => setLapAId(id)}
          onSetLapB={(id) => setLapBId(id)}
          participantsA={participantsA}
        />
      )}

      {/* 2-COLUMN MAIN COMPARISON LAYOUT */}
      {sessionAId !== '' && (lapAObj || lapBObj) && (
        <div className="comparator-layout" style={{ gridColumn: 'span 12' }}>
          {/* LEFT COLUMN: Summary cards & Telemetry Charts Stack */}
          <div className="comparator-charts-col">
            <ComparatorMetricsSummary
              lapAObj={lapAObj}
              lapBObj={lapBObj}
              nameA={nameA}
              nameB={nameB}
              driverA={driverA}
              driverB={driverB}
              totalDeltaMs={totalDeltaMs}
              s1Delta={s1Delta}
              s2Delta={s2Delta}
              s3Delta={s3Delta}
            />

            <ComparatorTelemetryCharts
              chartData={chartData}
              comparisonData={comparisonData}
              nameA={nameA}
              nameB={nameB}
              formatA={selectedSessionAObj?.packet_format}
              formatB={selectedSessionBObj?.packet_format}
              hoverDistance={hoverDistance}
              onHoverDistanceChange={setHoverDistance}
              zoomDomain={zoomDomain}
              onZoomDomainChange={setZoomDomain}
              sector1Distance={sector1Distance}
              sector2Distance={sector2Distance}
              sessionAId={sessionAId}
              loadingA={loadingA}
              loadingB={loadingB}
              onMouseMove={handleMouseMove}
            />
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar with Track Heatmap & Quick Race Engineer trigger */}
          {comparisonData.length > 0 && (
            <div className="comparator-sidebar-col">
              {/* Track Map */}
              <div className="glass-panel" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={15} color="var(--accent-primary)" /> Track Heatmap
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selectedSessionAObj && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {selectedSessionAObj.track_name}
                      </span>
                    )}
                    <button
                      type="button"
                      className="nav-tab active"
                      onClick={() => openChat()}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '12px',
                        background: 'rgba(0, 242, 254, 0.12)',
                        borderColor: 'rgba(0, 242, 254, 0.35)',
                        color: '#00f2fe',
                      }}
                      title="Open AI Race Engineer telemetry analysis"
                    >
                      <Sparkles size={12} color="#00f2fe" /> Ask AI
                    </button>
                  </div>
                </div>

                <ComparatorTrackMap
                  data={comparisonData}
                  activeDistance={hoverDistance}
                  height={380}
                  sector1Distance={sector1Distance}
                  sector2Distance={sector2Distance}
                  onSelectDistance={(dist) => setHoverDistance(dist)}
                />

                {/* Turn Quick-Jump Ribbon */}
                {detectedTurns.length > 0 && (
                  <div style={{ marginTop: '0.45rem', marginBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Turns (click to jump):</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{detectedTurns.length} turns</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        overflowX: 'auto',
                        paddingBottom: '3px',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      {detectedTurns.map((turn) => {
                        const isSelected = hoverDistance !== null && Math.abs(turn.distance - hoverDistance) <= 35;
                        return (
                          <button
                            key={turn.name}
                            type="button"
                            onClick={() => setHoverDistance(turn.distance)}
                            style={{
                              background: isSelected ? '#ffd200' : 'rgba(255, 255, 255, 0.08)',
                              color: isSelected ? '#000000' : '#ffffff',
                              border: isSelected ? '1px solid #ffd200' : '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                            title={`${turn.name} (${turn.distance}m)`}
                          >
                            {turn.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Hover Point Live Telemetry Readout */}
                {comparisonData.length > 0 && (() => {
                  const activePoint = hoverDistance !== null ? comparisonData.reduce((prev, curr) =>
                    Math.abs(curr.lap_distance - hoverDistance) < Math.abs(prev.lap_distance - hoverDistance) ? curr : prev
                  , comparisonData[0]) : null;

                  const turnContext = getTurnContextAtDistance(detectedTurns, hoverDistance);

                  return (
                    <div
                      style={{
                        marginTop: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.75rem',
                        minHeight: '112px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {activePoint ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Distance Point:</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f1c40f' }}>{activePoint.lap_distance}m</span>
                            </div>

                            {turnContext.label && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  background: turnContext.phase === 'apex' ? 'rgba(255, 210, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                  color: turnContext.phase === 'apex' ? '#ffd200' : 'rgba(255, 255, 255, 0.85)',
                                  border: turnContext.phase === 'apex' ? '1px solid rgba(255, 210, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                                  borderRadius: '3px',
                                  padding: '1px 5px',
                                }}
                              >
                                📍 {turnContext.label}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <div style={{ borderLeft: '2px solid #ff4757', paddingLeft: '0.35rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#ff4757', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</div>
                              <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedA ?? '-'} km/h</strong></div>
                              <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleA !== null ? Math.round(activePoint.throttleA * 100) : 0}% / {activePoint.brakeA !== null ? Math.round(activePoint.brakeA * 100) : 0}%</strong></div>
                              <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryA !== null ? activePoint.ersBatteryA.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeA ?? 0] || 'Off'})</strong></div>
                            </div>

                            <div style={{ borderLeft: '2px solid #00d2d3', paddingLeft: '0.35rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#00d2d3', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</div>
                              <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedB ?? '-'} km/h</strong></div>
                              <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleB !== null ? Math.round(activePoint.throttleB * 100) : 0}% / {activePoint.brakeB !== null ? Math.round(activePoint.brakeB * 100) : 0}%</strong></div>
                              <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryB !== null ? activePoint.ersBatteryB.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeB ?? 0] || 'Off'})</strong></div>
                            </div>
                          </div>

                          {activePoint.time_delta !== null && (
                            <div style={{ marginTop: '0.25rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontWeight: 700, fontSize: '0.74rem', color: activePoint.time_delta < 0 ? '#ff4757' : activePoint.time_delta > 0 ? '#00d2d3' : '#fff' }}>
                              Δ {activePoint.time_delta > 0 ? '+' : ''}{activePoint.time_delta.toFixed(3)}s
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.3rem 0' }}>
                          <span style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: '2px' }}>
                            🔍 Live Telemetry Inspection
                          </span>
                          Hover over graphs or track to inspect telemetry at that point
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
