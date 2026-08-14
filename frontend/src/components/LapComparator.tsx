import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sliders,
  X,
  Shield,
  Disc,
  Wrench,
  CircleDot,
  Fuel,
  Gauge,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Timer,
  ArrowLeftRight,
  Zap,
  RotateCcw,
  ZoomIn,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Link,
  Unlink,
} from 'lucide-react';
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
import { detectTrackTurns, getTurnContextAtDistance } from '../utils/trackTurns';
import { ComparatorTrackMap } from './ComparatorTrackMap';
import { AiRaceEngineer } from './AiRaceEngineer';
import { CustomLapSelector, renderTyreCompoundBadge } from './CustomLapSelector';
import type { Lap, Participant } from './CustomLapSelector';

interface Session {
  id: number;
  session_uid: string;
  track_name: string;
  session_type: string;
  weather?: string;
  created_at: string;
}

export const getRankBadgeStyle = (rank: number) => {
  if (rank === 1) {
    return {
      bg: 'rgba(255, 215, 0, 0.18)',
      color: '#ffd700',
      border: '1px solid rgba(255, 215, 0, 0.5)',
      label: 'P1',
    };
  }
  if (rank === 2) {
    return {
      bg: 'rgba(224, 224, 224, 0.18)',
      color: '#e0e0e0',
      border: '1px solid rgba(224, 224, 224, 0.45)',
      label: 'P2',
    };
  }
  if (rank === 3) {
    return {
      bg: 'rgba(205, 127, 50, 0.2)',
      color: '#cd7f32',
      border: '1px solid rgba(205, 127, 50, 0.45)',
      label: 'P3',
    };
  }
  return {
    bg: 'rgba(255, 255, 255, 0.07)',
    color: 'var(--text-secondary)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    label: `P${rank}`,
  };
};

export const getSessionBadgeClass = (typeStr?: string) => {
  if (!typeStr) return 'badge-gray';
  const lower = typeStr.toLowerCase();
  if (lower.includes('sprint')) return 'badge-orange';
  if (lower.includes('race')) return 'badge-red';
  if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'badge-purple';
  if (lower.includes('practice') || lower.includes('fp')) return 'badge-green';
  return 'badge-gray';
};

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

const ERS_MODE_NAMES: Record<number, string> = {
  0: 'Off',
  1: 'Medium',
  2: 'Hotlap',
  3: 'Overtake',
};

const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.72rem',
    lineHeight: '1.2',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
  },
  itemStyle: {
    padding: '1px 0',
    fontSize: '0.70rem',
    margin: 0,
  },
  labelStyle: {
    color: '#cbd5e1',
    fontSize: '0.68rem',
    marginBottom: '2px',
    fontWeight: 600,
  },
  wrapperStyle: {
    zIndex: 100,
    pointerEvents: 'none' as const,
  },
  labelFormatter: (label: any) => `${Math.round(Number(label))}m`,
};

export const LapComparator: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);

  // Dual session IDs & Synchronization link
  const [sessionAId, setSessionAId] = useState<number | ''>('');
  const [sessionBId, setSessionBId] = useState<number | ''>('');
  const [isLinkedSessions, setIsLinkedSessions] = useState(true);

  // Session A Dropdown state
  const [isSessionADropdownOpen, setIsSessionADropdownOpen] = useState(false);
  const [sessionASearchQuery, setSessionASearchQuery] = useState('');
  const [sessionATypeTab, setSessionATypeTab] = useState<'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE'>('ALL');
  const sessionADropdownRef = useRef<HTMLDivElement>(null);

  // Session B Dropdown state
  const [isSessionBDropdownOpen, setIsSessionBDropdownOpen] = useState(false);
  const [sessionBSearchQuery, setSessionBSearchQuery] = useState('');
  const [sessionBTypeTab, setSessionBTypeTab] = useState<'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE'>('ALL');
  const sessionBDropdownRef = useRef<HTMLDivElement>(null);

  // Session A Data
  const [lapsA, setLapsA] = useState<Lap[]>([]);
  const [participantsA, setParticipantsA] = useState<Participant[]>([]);
  const [carSetupsA, setCarSetupsA] = useState<CarSetup[]>([]);
  const [lapAId, setLapAId] = useState<number | ''>('');
  const [rawTelemetryA, setRawTelemetryA] = useState<TelemetrySamplePoint[]>([]);
  const [loadingA, setLoadingA] = useState(false);

  // Session B Data
  const [lapsB, setLapsB] = useState<Lap[]>([]);
  const [participantsB, setParticipantsB] = useState<Participant[]>([]);
  const [carSetupsB, setCarSetupsB] = useState<CarSetup[]>([]);
  const [lapBId, setLapBId] = useState<number | ''>('');
  const [rawTelemetryB, setRawTelemetryB] = useState<TelemetrySamplePoint[]>([]);
  const [loadingB, setLoadingB] = useState(false);

  // Active Setup Modal state
  const [activeSetupParticipant, setActiveSetupParticipant] = useState<{ participant: Participant; setup: CarSetup } | null>(null);

  // Chart Inspection & Zoom
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // Quick Select Leaderboard state with localStorage persistence
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
      // Ignore localStorage errors
    }
  }, [isQuickSelectOpen]);

  // Initial Fetch Sessions
  const fetchSessions = useCallback(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data: Session[]) => {
        const sessionList = data || [];
        setSessions(sessionList);
      })
      .catch((err) => console.error('Failed to fetch sessions', err));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Handle Session A Selection Change
  const handleSelectSessionA = (sessionId: number) => {
    setSessionAId(sessionId);
    setIsSessionADropdownOpen(false);
    if (isLinkedSessions) {
      setSessionBId(sessionId);
    } else {
      // If unlinked, verify if current sessionB is on the same track. If not, reset sessionB to new sessionA
      const newSessionA = sessions.find((s) => s.id === sessionId);
      const currentSessionB = sessions.find((s) => s.id === sessionBId);
      if (newSessionA && currentSessionB && newSessionA.track_name.toLowerCase() !== currentSessionB.track_name.toLowerCase()) {
        setSessionBId(sessionId);
      }
    }
  };

  // Handle Session B Selection Change
  const handleSelectSessionB = (sessionId: number) => {
    setSessionBId(sessionId);
    setIsSessionBDropdownOpen(false);
    if (sessionId !== sessionAId && isLinkedSessions) {
      setIsLinkedSessions(false);
    }
  };

  // Toggle Session Link / Same-Session mode
  const toggleSessionLink = () => {
    if (!isLinkedSessions) {
      // Re-link: sync session B to session A
      setIsLinkedSessions(true);
      if (sessionAId) {
        setSessionBId(sessionAId);
      }
    } else {
      // Unlink: allow separate session B
      setIsLinkedSessions(false);
    }
  };

  // Fetch Session A data
  useEffect(() => {
    setLapAId('');
    setRawTelemetryA([]);
    setZoomDomain(null);

    if (sessionAId) {
      fetch(`/api/sessions/${sessionAId}/laps`)
        .then((res) => res.json())
        .then((data: Lap[]) => {
          const list = data || [];
          setLapsA(list);
          // Auto-select fastest valid lap for Lap A
          if (list.length > 0) {
            const valid = list.filter((l) => l.is_valid && l.lap_time_ms > 0).sort((a, b) => a.lap_time_ms - b.lap_time_ms);
            const best = valid.length > 0 ? valid[0] : list[0];
            setLapAId(best.id);
          }
        })
        .catch((err) => console.error('Failed to fetch laps A', err));

      fetch(`/api/sessions/${sessionAId}/participants`)
        .then((res) => res.json())
        .then((data) => setParticipantsA(data || []))
        .catch((err) => console.error('Failed to fetch participants A', err));

      fetch(`/api/sessions/${sessionAId}/setups`)
        .then((res) => res.json())
        .then((data) => setCarSetupsA(data || []))
        .catch((err) => console.error('Failed to fetch car setups A', err));
    } else {
      setLapsA([]);
      setParticipantsA([]);
      setCarSetupsA([]);
    }
  }, [sessionAId]);

  // Fetch Session B data
  useEffect(() => {
    setLapBId('');
    setRawTelemetryB([]);

    if (sessionBId) {
      fetch(`/api/sessions/${sessionBId}/laps`)
        .then((res) => res.json())
        .then((data: Lap[]) => {
          const list = data || [];
          setLapsB(list);

          // Auto-select lap for Slot B
          if (list.length > 0) {
            const valid = list.filter((l) => l.is_valid && l.lap_time_ms > 0).sort((a, b) => a.lap_time_ms - b.lap_time_ms);
            if (isLinkedSessions && valid.length > 1) {
              setLapBId(valid[1].id);
            } else {
              const best = valid.length > 0 ? valid[0] : list[0];
              setLapBId(best.id);
            }
          }
        })
        .catch((err) => console.error('Failed to fetch laps B', err));

      fetch(`/api/sessions/${sessionBId}/participants`)
        .then((res) => res.json())
        .then((data) => setParticipantsB(data || []))
        .catch((err) => console.error('Failed to fetch participants B', err));

      fetch(`/api/sessions/${sessionBId}/setups`)
        .then((res) => res.json())
        .then((data) => setCarSetupsB(data || []))
        .catch((err) => console.error('Failed to fetch car setups B', err));
    } else {
      setLapsB([]);
      setParticipantsB([]);
      setCarSetupsB([]);
    }
  }, [sessionBId, isLinkedSessions]);

  // Fetch Lap A telemetry with server-side LTTB downsampling parameter maxPoints=800
  useEffect(() => {
    setRawTelemetryA([]);
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
    setRawTelemetryB([]);
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
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(sessionASearchQuery.toLowerCase());

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
      // Circuit strict restriction
      if (selectedSessionAObj && s.track_name.toLowerCase() !== selectedSessionAObj.track_name.toLowerCase()) {
        return false;
      }

      const matchesSearch =
        !sessionBSearchQuery ||
        s.track_name.toLowerCase().includes(sessionBSearchQuery.toLowerCase()) ||
        s.session_type.toLowerCase().includes(sessionBSearchQuery.toLowerCase()) ||
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(sessionBSearchQuery.toLowerCase());

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

  // Setup details for Lap A & B
  const setupA = useMemo(
    () => (lapAObj?.car_index !== undefined ? carSetupsA.find((s) => s.car_index === lapAObj.car_index) : undefined),
    [lapAObj, carSetupsA]
  );
  const setupB = useMemo(
    () => (lapBObj?.car_index !== undefined ? carSetupsB.find((s) => s.car_index === lapBObj.car_index) : undefined),
    [lapBObj, carSetupsB]
  );

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

    // Sort by bestLap lap_time_ms ascending (drivers without valid laps at the end)
    const sorted = [...candidateList].sort((a, b) => {
      const timeA = a.bestLap && a.bestLap.lap_time_ms > 0 ? a.bestLap.lap_time_ms : Infinity;
      const timeB = b.bestLap && b.bestLap.lap_time_ms > 0 ? b.bestLap.lap_time_ms : Infinity;
      return timeA - timeB;
    });

    // Leader lap time
    const leaderLapTimeMs = sorted.find((d) => d.bestLap && d.bestLap.lap_time_ms > 0)?.bestLap?.lap_time_ms ?? null;

    // Filter by search query
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
              <Gauge color="var(--accent-primary)" size={26} /> Lap Comparator
            </h2>
            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Compare laps, time deltas, braking points, throttle traces & setups across sessions
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
                    Cross-Session
                  </span>
                )}
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
                title="Swap Slot A and Slot B"
              >
                <ArrowLeftRight size={13} /> Swap
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
                title={isQuickSelectOpen ? 'Collapse Quick Select Driver leaderboard' : 'Expand Quick Select Driver leaderboard'}
                data-testid="toggle-quick-select-toolbar-btn"
              >
                <Zap size={13} color={isQuickSelectOpen ? '#00d2d3' : 'var(--accent-primary)'} />
                <span>Drivers ({quickSelectData.totalCount})</span>
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
                title="Clear Lap Selections"
              >
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* SIDE-BY-SIDE COMPARISON SLOTS CONTAINER */}
        <div className="comparator-slots-container">
          {/* SLOT A CARD (Red Solid) */}
          <div className="comparator-slot-card slot-a">
            <div className="slot-card-header">
              <span style={{ color: '#ff4757', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '1rem' }}>●</span> Slot A (Baseline)
              </span>
              {driverA && (
                <span
                  title={`#${driverA.race_number} ${driverA.name}`}
                  style={{
                    fontSize: '0.75rem',
                    color: '#ff4757',
                    fontWeight: 600,
                    textTransform: 'none',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{driverA.race_number} {driverA.name}
                </span>
              )}
            </div>

            {/* Session A Selector */}
            <div
              ref={sessionADropdownRef}
              className={`custom-session-dropdown ${isSessionADropdownOpen ? 'is-open' : ''}`}
              style={{ position: 'relative', zIndex: isSessionADropdownOpen ? 100 : 1 }}
            >
              <button
                type="button"
                className={`custom-session-trigger ${isSessionADropdownOpen ? 'is-open' : ''}`}
                onClick={() => setIsSessionADropdownOpen((prev) => !prev)}
                aria-expanded={isSessionADropdownOpen}
                aria-haspopup="listbox"
                data-testid="session-selector-trigger"
              >
                {selectedSessionAObj ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <MapPin size={14} color="#ff4757" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSessionAObj.track_name}</span>
                    <span className={`session-badge ${getSessionBadgeClass(selectedSessionAObj.session_type)}`} style={{ fontSize: '0.65rem', padding: '1px 6px', flexShrink: 0 }}>
                      {selectedSessionAObj.session_type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      ({new Date(selectedSessionAObj.created_at).toLocaleDateString()})
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Select Session A...</span>
                )}
                {isSessionADropdownOpen ? (
                  <ChevronUp size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                )}
              </button>

              {/* Popover A */}
              {isSessionADropdownOpen && (
                <div className="custom-session-popover" role="listbox">
                  <div className="custom-session-search-wrapper">
                    <Search size={14} className="custom-session-search-icon" />
                    <input
                      type="text"
                      className="custom-session-search-input"
                      placeholder="Search track, type, date..."
                      value={sessionASearchQuery}
                      onChange={(e) => setSessionASearchQuery(e.target.value)}
                      autoFocus
                    />
                    {sessionASearchQuery && (
                      <button
                        type="button"
                        className="custom-session-clear-btn"
                        onClick={() => setSessionASearchQuery('')}
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="custom-session-filter-tabs">
                    {(['ALL', 'RACE', 'SPRINT', 'QUALI', 'PRACTICE'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`custom-session-filter-tab ${sessionATypeTab === tab ? 'active' : ''}`}
                        onClick={() => setSessionATypeTab(tab)}
                      >
                        {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <div className="custom-session-list">
                    {filteredDropdownSessionsA.length > 0 ? (
                      filteredDropdownSessionsA.map((s) => {
                        const isSelected = s.id === sessionAId;
                        return (
                          <div
                            key={s.id}
                            className={`custom-session-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectSessionA(s.id)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="custom-session-item-main">
                              <div className="custom-session-item-title">
                                <MapPin size={13} color="#ff4757" />
                                <span>{s.track_name}</span>
                                <span className={`session-badge ${getSessionBadgeClass(s.session_type)}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                  {s.session_type}
                                </span>
                              </div>
                              <div className="custom-session-item-meta">
                                <span>{new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {s.weather && <span>• {s.weather}</span>}
                              </div>
                            </div>
                            {isSelected && <Check size={14} color="#ff4757" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        No sessions match your filter.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Lap Selector for Lap A */}
            <CustomLapSelector
              laps={lapsA}
              participants={participantsA}
              selectedLapId={lapAId}
              onSelectLap={(id) => setLapAId(id)}
              slot="A"
              disabled={!sessionAId}
              placeholder="Select Lap A..."
            />
          </div>

          {/* CENTER LINK / SYNC BUTTON */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <button
              type="button"
              className={`slot-session-sync-btn ${isLinkedSessions ? 'is-linked' : 'is-unlinked'}`}
              onClick={toggleSessionLink}
              title={isLinkedSessions ? 'Sessions linked to same session. Click to unlock Cross-Session comparison.' : 'Cross-session mode active. Click to lock sessions to same session.'}
              data-testid="session-sync-toggle"
            >
              {isLinkedSessions ? <Link size={16} /> : <Unlink size={16} />}
              <span>{isLinkedSessions ? 'Linked' : 'Cross-Session'}</span>
            </button>
          </div>

          {/* SLOT B CARD (Cyan Dashed) */}
          <div className="comparator-slot-card slot-b">
            <div className="slot-card-header">
              <span style={{ color: '#00d2d3', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '1rem' }}>●</span> Slot B (Comparison)
              </span>
              {driverB && (
                <span
                  title={`#${driverB.race_number} ${driverB.name}`}
                  style={{
                    fontSize: '0.75rem',
                    color: '#00d2d3',
                    fontWeight: 600,
                    textTransform: 'none',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  #{driverB.race_number} {driverB.name}
                </span>
              )}
            </div>

            {/* Session B Selector */}
            <div
              ref={sessionBDropdownRef}
              className={`custom-session-dropdown ${isSessionBDropdownOpen ? 'is-open' : ''}`}
              style={{ position: 'relative', zIndex: isSessionBDropdownOpen ? 100 : 1 }}
            >
              <button
                type="button"
                className={`custom-session-trigger ${isSessionBDropdownOpen ? 'is-open' : ''}`}
                onClick={() => setIsSessionBDropdownOpen((prev) => !prev)}
                aria-expanded={isSessionBDropdownOpen}
                aria-haspopup="listbox"
                data-testid="session-b-selector-trigger"
              >
                {selectedSessionBObj ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <MapPin size={14} color="#00d2d3" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSessionBObj.track_name}</span>
                    <span className={`session-badge ${getSessionBadgeClass(selectedSessionBObj.session_type)}`} style={{ fontSize: '0.65rem', padding: '1px 6px', flexShrink: 0 }}>
                      {selectedSessionBObj.session_type}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      ({new Date(selectedSessionBObj.created_at).toLocaleDateString()})
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Select Session B...</span>
                )}
                {isSessionBDropdownOpen ? (
                  <ChevronUp size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={15} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                )}
              </button>

              {/* Popover B */}
              {isSessionBDropdownOpen && (
                <div className="custom-session-popover" role="listbox">
                  {selectedSessionAObj && (
                    <div style={{ padding: '0.35rem 0.6rem', background: 'rgba(0, 210, 211, 0.1)', borderBottom: '1px solid rgba(0, 210, 211, 0.2)', fontSize: '0.7rem', color: '#00d2d3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={11} /> Filtered to {selectedSessionAObj.track_name}
                    </div>
                  )}

                  <div className="custom-session-search-wrapper">
                    <Search size={14} className="custom-session-search-icon" />
                    <input
                      type="text"
                      className="custom-session-search-input"
                      placeholder="Search session type, date..."
                      value={sessionBSearchQuery}
                      onChange={(e) => setSessionBSearchQuery(e.target.value)}
                      autoFocus
                    />
                    {sessionBSearchQuery && (
                      <button
                        type="button"
                        className="custom-session-clear-btn"
                        onClick={() => setSessionBSearchQuery('')}
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="custom-session-filter-tabs">
                    {(['ALL', 'RACE', 'SPRINT', 'QUALI', 'PRACTICE'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`custom-session-filter-tab ${sessionBTypeTab === tab ? 'active' : ''}`}
                        onClick={() => setSessionBTypeTab(tab)}
                      >
                        {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <div className="custom-session-list">
                    {filteredDropdownSessionsB.length > 0 ? (
                      filteredDropdownSessionsB.map((s) => {
                        const isSelected = s.id === sessionBId;
                        return (
                          <div
                            key={s.id}
                            className={`custom-session-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectSessionB(s.id)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="custom-session-item-main">
                              <div className="custom-session-item-title">
                                <MapPin size={13} color="#00d2d3" />
                                <span>{s.track_name}</span>
                                <span className={`session-badge ${getSessionBadgeClass(s.session_type)}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                  {s.session_type}
                                </span>
                              </div>
                              <div className="custom-session-item-meta">
                                <span>{new Date(s.created_at).toLocaleDateString()} {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {s.weather && <span>• {s.weather}</span>}
                              </div>
                            </div>
                            {isSelected && <Check size={14} color="#00d2d3" style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        No matching sessions for this track.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Lap Selector for Lap B */}
            <CustomLapSelector
              laps={lapsB}
              participants={participantsB}
              selectedLapId={lapBId}
              onSelectLap={(id) => setLapBId(id)}
              slot="B"
              disabled={!sessionBId}
              placeholder="Select Lap B..."
            />
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

      {/* Enhanced Collapsible Quick Select Driver Leaderboard */}
      {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
        <div
          className="glass-panel"
          style={{
            gridColumn: 'span 12',
            padding: '0.75rem 1.25rem',
            transition: 'all 0.2s ease',
          }}
          data-testid="quick-select-panel"
        >
          {/* Panel Header & Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setIsQuickSelectOpen((prev) => !prev)}
            data-testid="quick-select-header-toggle"
          >
            {/* Left: Title, Driver Count Badge & Collapsed Snippet */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Zap size={15} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quick Select Driver Leaderboard
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                  data-testid="quick-select-driver-count"
                >
                  {quickSelectData.drivers.length}{driverSearchQuery ? ` / ${quickSelectData.totalCount}` : ''} drivers
                </span>
              </div>

              {/* Top 3 snippet when collapsed */}
              {!isQuickSelectOpen && quickSelectData.drivers.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
                  {quickSelectData.drivers.slice(0, 3).map((d, i) => (
                    <span
                      key={`${d.session_id}-${d.car_index}`}
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: i === 0 ? '#ffd700' : 'var(--text-secondary)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      P{i + 1}: {d.name.split(' ').pop()} {d.bestLap ? formatTime(d.bestLap.lap_time_ms) : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Controls (Tabs, Search, Collapse Button) */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Session Tabs when in Cross-Session Mode */}
              {!isLinkedSessions && sessionAId !== sessionBId && isQuickSelectOpen && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.35)',
                    padding: '2px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  data-testid="quick-select-session-tabs"
                >
                  <button
                    type="button"
                    onClick={() => setQuickSelectSessionTab('ALL')}
                    style={{
                      background: quickSelectSessionTab === 'ALL' ? 'rgba(255,255,255,0.15)' : 'transparent',
                      border: 'none',
                      color: quickSelectSessionTab === 'ALL' ? '#fff' : 'var(--text-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    data-testid="quick-tab-all"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSelectSessionTab('A')}
                    style={{
                      background: quickSelectSessionTab === 'A' ? 'rgba(255, 71, 87, 0.2)' : 'transparent',
                      border: 'none',
                      color: quickSelectSessionTab === 'A' ? '#ff4757' : 'var(--text-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    data-testid="quick-tab-a"
                  >
                    Session A
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickSelectSessionTab('B')}
                    style={{
                      background: quickSelectSessionTab === 'B' ? 'rgba(0, 210, 211, 0.2)' : 'transparent',
                      border: 'none',
                      color: quickSelectSessionTab === 'B' ? '#00d2d3' : 'var(--text-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    data-testid="quick-tab-b"
                  >
                    Session B
                  </button>
                </div>
              )}

              {/* Driver Search Box */}
              {isQuickSelectOpen && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Filter drivers..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '0.25rem 1.6rem 0.25rem 1.6rem',
                      fontSize: '0.75rem',
                      color: '#fff',
                      width: '130px',
                      outline: 'none',
                    }}
                    data-testid="driver-quick-search-input"
                  />
                  {driverSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDriverSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 0,
                      }}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Expand / Collapse Button */}
              <button
                type="button"
                onClick={() => setIsQuickSelectOpen((prev) => !prev)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                  padding: '0.2rem 0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
                title={isQuickSelectOpen ? 'Collapse Quick Select' : 'Expand Quick Select'}
                data-testid="quick-select-collapse-btn"
              >
                {isQuickSelectOpen ? (
                  <>
                    <span>Collapse</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>Expand</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expanded Driver Leaderboard Grid */}
          {isQuickSelectOpen && (
            <div style={{ marginTop: '0.75rem' }}>
              {quickSelectData.drivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No drivers found matching "{driverSearchQuery}".
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                    gap: '0.6rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '0.2rem',
                  }}
                  data-testid="quick-select-drivers-grid"
                >
                  {quickSelectData.drivers.map((p, idx) => {
                    const isAssignedA = lapAObj && (lapAObj.car_index ?? -1) === p.car_index && (isLinkedSessions || lapAObj.session_id === p.session_id);
                    const isAssignedB = lapBObj && (lapBObj.car_index ?? -1) === p.car_index && (isLinkedSessions || lapBObj.session_id === p.session_id);
                    const rankStyle = getRankBadgeStyle(idx + 1);

                    let borderStyle = '1px solid rgba(255, 255, 255, 0.08)';
                    let bgStyle = 'rgba(255, 255, 255, 0.03)';
                    let boxShadow = 'none';

                    if (isAssignedA && isAssignedB) {
                      borderStyle = '1px solid rgba(0, 210, 211, 0.6)';
                      bgStyle = 'linear-gradient(135deg, rgba(255, 71, 87, 0.08) 0%, rgba(0, 210, 211, 0.08) 100%)';
                      boxShadow = '0 0 10px rgba(0, 210, 211, 0.15)';
                    } else if (isAssignedA) {
                      borderStyle = '1px solid rgba(255, 71, 87, 0.6)';
                      bgStyle = 'rgba(255, 71, 87, 0.06)';
                      boxShadow = '0 0 10px rgba(255, 71, 87, 0.15)';
                    } else if (isAssignedB) {
                      borderStyle = '1px solid rgba(0, 210, 211, 0.6)';
                      bgStyle = 'rgba(0, 210, 211, 0.06)';
                      boxShadow = '0 0 10px rgba(0, 210, 211, 0.15)';
                    }

                    const isParticipantInA = activeParticipantsA.some((pa) => pa.car_index === p.car_index && pa.session_id === p.session_id);

                    return (
                      <div
                        key={`${p.session_id}-${p.car_index}-${p.sessionSlot || ''}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          background: bgStyle,
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: borderStyle,
                          boxShadow,
                          transition: 'all 0.15s ease',
                        }}
                        data-testid={`driver-card-${p.car_index}`}
                      >
                        {/* Top Row: Rank, Driver Name, Tyre Badge, Active Slot Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: rankStyle.bg,
                                color: rankStyle.color,
                                border: rankStyle.border,
                                fontFamily: 'var(--font-mono)',
                                flexShrink: 0,
                              }}
                              data-testid={`rank-badge-${idx + 1}`}
                            >
                              {rankStyle.label}
                            </span>

                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`#${p.race_number} ${p.name}`}
                            >
                              #{p.race_number} {p.name}
                            </span>

                            {p.bestLap?.tyre_compound && renderTyreCompoundBadge(p.bestLap.tyre_compound)}

                            {/* Session Slot Tag in Cross-Session All Tab */}
                            {!isLinkedSessions && sessionAId !== sessionBId && quickSelectSessionTab === 'ALL' && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  background: p.sessionSlot === 'A' ? 'rgba(255, 71, 87, 0.15)' : 'rgba(0, 210, 211, 0.15)',
                                  color: p.sessionSlot === 'A' ? '#ff4757' : '#00d2d3',
                                  fontWeight: 600,
                                }}
                              >
                                {p.sessionSlot === 'A' ? 'S-A' : 'S-B'}
                              </span>
                            )}
                          </div>

                          {/* Active Slot Highlight Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                            {isAssignedA && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(255, 71, 87, 0.25)',
                                  color: '#ff4757',
                                  fontWeight: 700,
                                  border: '1px solid #ff4757',
                                }}
                                data-testid="driver-assigned-a-badge"
                              >
                                Slot A
                              </span>
                            )}
                            {isAssignedB && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: 'rgba(0, 210, 211, 0.25)',
                                  color: '#00d2d3',
                                  fontWeight: 700,
                                  border: '1px solid #00d2d3',
                                }}
                                data-testid="driver-assigned-b-badge"
                              >
                                Slot B
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle Row: Lap Time & Leader Delta & Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', minWidth: 0 }}>
                            {p.bestLap ? (
                              <>
                                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                  {formatTime(p.bestLap.lap_time_ms)}
                                </span>
                                {quickSelectData.leaderLapTimeMs && p.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs ? (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      color: '#ffd700',
                                      background: 'rgba(255, 215, 0, 0.12)',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                    }}
                                  >
                                    LEADER
                                  </span>
                                ) : quickSelectData.leaderLapTimeMs && p.bestLap.lap_time_ms > quickSelectData.leaderLapTimeMs ? (
                                  <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                    +{((p.bestLap.lap_time_ms - quickSelectData.leaderLapTimeMs) / 1000).toFixed(3)}s
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No valid lap</span>
                            )}
                          </div>

                          {/* Quick Set Actions */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            {(isLinkedSessions || isParticipantInA || p.sessionSlot === 'A') && (
                              <button
                                type="button"
                                onClick={() => {
                                  const targetLaps = lapsA;
                                  const driverLaps = targetLaps
                                    .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0)
                                    .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
                                  if (driverLaps.length > 0) setLapAId(driverLaps[0].id);
                                }}
                                style={{
                                  background: isAssignedA ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 71, 87, 0.15)',
                                  border: '1px solid rgba(255, 71, 87, 0.6)',
                                  color: '#ff4757',
                                  borderRadius: '4px',
                                  padding: '0.15rem 0.45rem',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                                title={`Set Lap A to ${p.name}'s fastest lap`}
                                data-testid={`quick-set-a-${p.car_index}`}
                              >
                                Set A
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const targetLaps = lapsB;
                                const driverLaps = targetLaps
                                  .filter((l) => (l.car_index ?? -1) === p.car_index && l.is_valid && l.lap_time_ms > 0)
                                  .sort((a, b) => a.lap_time_ms - b.lap_time_ms);
                                if (driverLaps.length > 0) setLapBId(driverLaps[0].id);
                              }}
                              style={{
                                background: isAssignedB ? 'rgba(0, 210, 211, 0.3)' : 'rgba(0, 210, 211, 0.15)',
                                border: '1px solid rgba(0, 210, 211, 0.6)',
                                color: '#00d2d3',
                                borderRadius: '4px',
                                padding: '0.15rem 0.45rem',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                              title={`Set Lap B to ${p.name}'s fastest lap`}
                              data-testid={`quick-set-b-${p.car_index}`}
                            >
                              Set B
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Sector Timings */}
                        {p.bestLap && (p.bestLap.sector1_ms || p.bestLap.sector2_ms || p.bestLap.sector3_ms) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.bestLap.sector1_ms ? (
                              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                                S1: {(p.bestLap.sector1_ms / 1000).toFixed(3)}
                              </span>
                            ) : null}
                            {p.bestLap.sector2_ms ? (
                              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                                S2: {(p.bestLap.sector2_ms / 1000).toFixed(3)}
                              </span>
                            ) : null}
                            {p.bestLap.sector3_ms ? (
                              <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                                S3: {(p.bestLap.sector3_ms / 1000).toFixed(3)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2-COLUMN MAIN COMPARISON LAYOUT */}
      {sessionAId !== '' && (lapAObj || lapBObj) && (
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
                {/* 1. TIME DELTA CHART */}
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
                          {...compactTooltipProps}
                          formatter={(val: any) => [`${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(3)}s`, `Time Delta (${nameA} vs ${nameB})`]}
                        />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} formatter={(val: any) => [`${Math.round(Number(val) * 100)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} formatter={(val: any) => [`${Math.round(Number(val) * 100)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                        <Tooltip {...compactTooltipProps} formatter={(val: any) => [`${Number(val).toFixed(1)}%`]} />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
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
                          {...compactTooltipProps}
                          formatter={(val: any, name?: any) => {
                            const modeNum = Math.round(Number(val));
                            return [ERS_MODE_NAMES[modeNum] || `Mode ${modeNum}`, String(name ?? '')];
                          }}
                        />
                        {sector1Distance && <ReferenceLine x={sector1Distance} stroke="#f39c12" strokeDasharray="3 3" label={{ value: 'S1', fill: '#f39c12', fontSize: 10, position: 'top' }} />}
                        {sector2Distance && <ReferenceLine x={sector2Distance} stroke="#9b59b6" strokeDasharray="3 3" label={{ value: 'S2', fill: '#9b59b6', fontSize: 10, position: 'top' }} />}
                        {hoverDistance !== null && <ReferenceLine x={hoverDistance} stroke="#ffd200" strokeWidth={2} strokeDasharray="3 3" />}
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '2px' }} iconSize={10} />
                        <Line type="stepAfter" dataKey="ersDeployModeA" name={`${nameA} Mode`} stroke="#ff4757" dot={false} strokeWidth={2} isAnimationActive={false} />
                        <Line type="stepAfter" dataKey="ersDeployModeB" name={`${nameB} Mode`} stroke="#00d2d3" dot={false} strokeWidth={2} strokeDasharray="4 4" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
                  {!sessionAId
                    ? 'Select a session and two laps above to compare telemetry.'
                    : loadingA || loadingB
                    ? 'Loading telemetry data...'
                    : 'Select Lap A and Lap B to generate comparison charts.'}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar with AI Race Engineer on TOP and Track Heatmap at BOTTOM */}
          {comparisonData.length > 0 && (
            <div className="comparator-sidebar-col">
              {/* AI Race Engineer Compact Card on TOP */}
              <AiRaceEngineer
                telemetryContext={telemetryContext}
                hasLapsSelected={Boolean(lapAId && lapBId && lapAObj && lapBObj)}
                isZoomActive={Boolean(zoomDomain)}
              />

              {/* Track Map at BOTTOM */}
              <div className="glass-panel" style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={15} color="var(--accent-primary)" /> Track Heatmap
                  </h4>
                  {selectedSessionAObj && (
                    <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.4rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {selectedSessionAObj.track_name}
                    </span>
                  )}
                </div>

                <ComparatorTrackMap
                  data={comparisonData}
                  activeDistance={hoverDistance}
                  height={320}
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
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-container glass-panel"
        style={{
          maxWidth: '850px',
          background: 'rgba(18, 18, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        }}
        onClick={e => e.stopPropagation()}
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
  if (!ms || ms <= 0) return '--:--.---';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const m = ms % 1000;
  return `${mins}:${secs.toString().padStart(2, '0')}.${m.toString().padStart(3, '0')}`;
}
