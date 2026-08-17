import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Trophy,
  Wrench,
  CloudSun,
  Flag,
  Users,
  ArrowLeft,
  Filter,
  RefreshCw,
  Disc,
  Sliders,
  Shield,
  Zap,
  X,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  List,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { TEAM_COLORS } from './LeaderboardTower';
import { SessionKPIBar } from './session_history/SessionKPIBar';
import { SessionCardGrid } from './session_history/SessionCardGrid';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionClassificationTab } from './session_history/SessionClassificationTab';
import type { DriverStanding } from './session_history/SessionClassificationTab';
import { SessionLapChartsTab } from './session_history/SessionLapChartsTab';
import { SessionSectorMatrixTab } from './session_history/SessionSectorMatrixTab';
import { SessionAiDebriefDrawer } from './session_history/SessionAiDebriefDrawer';

export interface Session {
  id: number;
  session_uid: string | number;
  track_id?: number;
  track_name: string;
  session_type: string;
  weather: string;
  packet_format?: number;
  created_at: string;
}

export interface Participant {
  id: number;
  session_id: number;
  car_index: number;
  name: string;
  driver_id: number;
  team_id: number;
  race_number: number;
  ai_controlled: boolean;
  nationality?: number;
}

export interface Lap {
  id: number;
  session_id: number;
  car_index: number;
  lap_number: number;
  lap_time_ms: number;
  sector1_ms: number;
  sector2_ms: number;
  sector3_ms: number;
  is_valid: boolean;
  tyre_compound: string;
  fuel_load: number;
  max_speed_kmh: number;
  penalties_seconds?: number;
  car_position?: number;
  result_status?: number;
  stint?: number;
  created_at?: string;
}

export interface CarSetup {
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

interface SessionHistoryProps {
  onNavigateToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onNavigateToComparator }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('ALL');
  const [circuitFilter, setCircuitFilter] = useState<string>('ALL');

  // View Mode & Sorting
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortField, setSortField] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected Session Detail state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [setups, setSetups] = useState<CarSetup[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

  // Active Sub-Tab in Session Detail ('classification' | 'charts' | 'sectors')
  const [activeDetailTab, setActiveDetailTab] = useState<'classification' | 'charts' | 'sectors'>('classification');

  // AI Debrief Drawer State
  const [isAiDebriefOpen, setIsAiDebriefOpen] = useState<boolean>(false);

  // Setup Modal State
  const [selectedSetupDriver, setSelectedSetupDriver] = useState<DriverStanding | null>(null);

  // Deletion State & Handler
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const targetId = sessionToDelete.id;
    setDeletingSessionId(targetId);
    try {
      const res = await fetch(`/api/sessions/${targetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete session');

      setSessions((prev) => prev.filter((s) => s.id !== targetId));
      if (selectedSession && selectedSession.id === targetId) {
        setSelectedSession(null);
      }
      setSessionToDelete(null);
    } catch (err: any) {
      console.error('Error deleting session:', err);
      alert(`Error deleting session: ${err.message || err}`);
    } finally {
      setDeletingSessionId(null);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data: Session[] = await res.json();
      setSessions(data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (session: Session) => {
    setSelectedSession(session);
    setLoadingDetail(true);
    setExpandedDrivers({});
    setSelectedSetupDriver(null);
    setActiveDetailTab('classification');
    setIsAiDebriefOpen(false);

    try {
      const [partsRes, lapsRes, setupsRes] = await Promise.all([
        fetch(`/api/sessions/${session.id}/participants`),
        fetch(`/api/sessions/${session.id}/laps`),
        fetch(`/api/sessions/${session.id}/setups`),
      ]);

      const partsData = partsRes.ok ? await partsRes.json() : [];
      const lapsData = lapsRes.ok ? await lapsRes.json() : [];
      const setupsData = setupsRes.ok ? await setupsRes.json() : [];

      setParticipants(partsData || []);
      setLaps(lapsData || []);
      setSetups(setupsData || []);
    } catch (err: any) {
      console.error('Error fetching session details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleDriverExpand = (carIndex: number) => {
    setExpandedDrivers((prev) => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
  };

  const handleToggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const formatLapTime = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const formatTotalDuration = (ms: number) => {
    if (!ms || ms <= 0) return '--:--.---';
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  const renderTyreBadge = (compoundRaw?: string) => {
    if (!compoundRaw || compoundRaw.trim() === '') {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const str = compoundRaw.trim().toUpperCase();

    let label = str;
    let color = '#FFFFFF';
    let bg = 'rgba(255, 255, 255, 0.15)';

    if (str === '16' || str.includes('SOFT') || str === 'S') {
      label = 'S';
      color = '#FF3333';
      bg = 'rgba(255, 51, 51, 0.15)';
    } else if (str === '17' || str.includes('MEDIUM') || str === 'M') {
      label = 'M';
      color = '#FFD700';
      bg = 'rgba(255, 215, 0, 0.15)';
    } else if (str === '18' || str.includes('HARD') || str === 'H') {
      label = 'H';
      color = '#FFFFFF';
      bg = 'rgba(255, 255, 255, 0.15)';
    } else if (str === '7' || str.includes('INTER') || str === 'I') {
      label = 'I';
      color = '#33FF33';
      bg = 'rgba(51, 255, 51, 0.15)';
    } else if (str === '8' || str.includes('WET') || str === 'W') {
      label = 'W';
      color = '#3399FF';
      bg = 'rgba(51, 153, 255, 0.15)';
    }

    return (
      <div
        className="tyre-badge mono"
        title={`Tyre Compound: ${compoundRaw}`}
        style={{ color, backgroundColor: bg, borderColor: color }}
      >
        {label}
      </div>
    );
  };

  const renderDriverTyreStints = (driverLaps: Lap[]) => {
    if (!driverLaps || driverLaps.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const sortedLaps = [...driverLaps].sort((a, b) => a.lap_number - b.lap_number);
    const stints: { compound: string; count: number; stintId: number }[] = [];
    let currentStint: { compound: string; count: number; stintId: number } | null = null;

    sortedLaps.forEach((lap) => {
      const raw = lap.tyre_compound?.trim();
      if (!raw) return;

      const lapStint = lap.stint && lap.stint > 0 ? lap.stint : 0;

      const isNewStint =
        !currentStint ||
        (lapStint > 0 && currentStint.stintId > 0 && lapStint !== currentStint.stintId) ||
        currentStint.compound.toUpperCase() !== raw.toUpperCase();

      if (isNewStint || !currentStint) {
        currentStint = { compound: raw, count: 1, stintId: lapStint };
        stints.push(currentStint);
      } else {
        currentStint.count += 1;
      }
    });

    if (stints.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
        {stints.map(({ compound, count }, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 1px' }}>➔</span>}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {renderTyreBadge(compound)}
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {count}L
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown Date';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const getSessionBadgeClass = (typeStr?: string) => {
    if (!typeStr) return 'badge-gray';
    const lower = typeStr.toLowerCase();
    if (lower.includes('sprint')) return 'badge-orange';
    if (lower.includes('race')) return 'badge-red';
    if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'badge-purple';
    if (lower.includes('practice') || lower.includes('fp')) return 'badge-green';
    return 'badge-gray';
  };

  // Distinct track circuits list for filter dropdown
  const uniqueCircuits = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.track_name) set.add(s.track_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Session filtering and sorting logic
  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.track_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.session_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.id).includes(searchQuery);

      const matchesType =
        sessionTypeFilter === 'ALL' ||
        s.session_type?.toLowerCase().includes(sessionTypeFilter.toLowerCase());

      const matchesCircuit =
        circuitFilter === 'ALL' ||
        s.track_name?.toLowerCase() === circuitFilter.toLowerCase();

      return matchesSearch && matchesType && matchesCircuit;
    });

    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'id') {
        comp = a.id - b.id;
      } else if (sortField === 'track') {
        comp = (a.track_name || '').localeCompare(b.track_name || '');
      } else if (sortField === 'type') {
        comp = (a.session_type || '').localeCompare(b.session_type || '');
      } else {
        // date
        comp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [sessions, searchQuery, sessionTypeFilter, circuitFilter, sortField, sortOrder]);

  const isRaceSession = !!selectedSession?.session_type?.toLowerCase().includes('race');

  // Sector Records across entire session
  const { sessionBestS1, sessionBestS2, sessionBestS3 } = useMemo(() => {
    let s1 = Infinity;
    let s2 = Infinity;
    let s3 = Infinity;

    laps.forEach((l) => {
      if (l.is_valid && l.lap_time_ms > 0) {
        if (l.sector1_ms > 0 && l.sector1_ms < s1) s1 = l.sector1_ms;
        if (l.sector2_ms > 0 && l.sector2_ms < s2) s2 = l.sector2_ms;
        if (l.sector3_ms > 0 && l.sector3_ms < s3) s3 = l.sector3_ms;
      }
    });

    return {
      sessionBestS1: s1 < Infinity ? s1 : 0,
      sessionBestS2: s2 < Infinity ? s2 : 0,
      sessionBestS3: s3 < Infinity ? s3 : 0,
    };
  }, [laps]);

  // Driver standings calculation for selected session
  const driverStandings: DriverStanding[] = useMemo(() => {
    if (!selectedSession) return [];

    const lapsByCar: Record<number, Lap[]> = {};
    laps.forEach((l) => {
      if (!lapsByCar[l.car_index]) lapsByCar[l.car_index] = [];
      lapsByCar[l.car_index].push(l);
    });

    const maxRaceLaps = laps.reduce((max, l) => (l.lap_time_ms > 0 && l.lap_number > max ? l.lap_number : max), 0);

    const driverList = (participants.length > 0
      ? participants
      : Object.keys(lapsByCar).map((idxStr) => ({
          id: Number(idxStr),
          session_id: selectedSession.id,
          car_index: Number(idxStr),
          name: `Driver ${Number(idxStr) + 1}`,
          driver_id: 0,
          team_id: 0,
          race_number: Number(idxStr) + 1,
          ai_controlled: false,
        }))
    ).map((p) => {
      const rawDriverLaps = lapsByCar[p.car_index] || [];
      const sortedRawLaps = [...rawDriverLaps].sort((a, b) => a.lap_number - b.lap_number);
      const completedLaps = sortedRawLaps.filter((l) => l.lap_time_ms > 0);
      const driverLaps = completedLaps.length > 0 ? completedLaps : sortedRawLaps;
      const validLaps = driverLaps.filter((l) => l.is_valid && l.lap_time_ms > 0);

      let bestLap: Lap | null = null;
      if (validLaps.length > 0) {
        bestLap = validLaps.reduce((prev, curr) => (curr.lap_time_ms < prev.lap_time_ms ? curr : prev), validLaps[0]);
      } else if (driverLaps.length > 0) {
        bestLap = driverLaps.reduce((prev, curr) => (curr.lap_time_ms < prev.lap_time_ms ? curr : prev), driverLaps[0]);
      }

      const lastCompletedLap =
        [...completedLaps].reverse().find((l) => l.lap_time_ms > 0) ||
        (sortedRawLaps.length > 0 ? sortedRawLaps[sortedRawLaps.length - 1] : null);
      const lastLapTimeMS = lastCompletedLap && lastCompletedLap.lap_time_ms > 0 ? lastCompletedLap.lap_time_ms : 0;

      const totalRaceTimeMS = driverLaps.reduce((acc, l) => acc + (l.lap_time_ms > 0 ? l.lap_time_ms : 0), 0);
      const penaltySeconds = driverLaps.reduce((maxPen, l) => Math.max(maxPen, l.penalties_seconds || 0), 0);
      const totalRaceTimeWithPenalties = totalRaceTimeMS + penaltySeconds * 1000;

      const lapWithPos = [...sortedRawLaps].reverse().find((l) => l.car_position && l.car_position > 0);
      const officialPos = lapWithPos ? lapWithPos.car_position! : 0;

      const lapWithStatus = [...sortedRawLaps].reverse().find((l) => l.result_status !== undefined && l.result_status > 0);
      const resStatus = lapWithStatus ? lapWithStatus.result_status! : 0;

      const isDSQ = resStatus === 5;
      const isDNF = resStatus === 4 || resStatus === 6 || resStatus === 7 || (isRaceSession && maxRaceLaps > 5 && completedLaps.length < maxRaceLaps);

      const maxSpeed = driverLaps.reduce((max, l) => Math.max(max, l.max_speed_kmh || 0), 0);
      const setup = setups.find((s) => s.car_index === p.car_index);

      // Best Sectors per driver
      let bestS1MS = 0;
      let bestS2MS = 0;
      let bestS3MS = 0;

      validLaps.forEach((l) => {
        if (l.sector1_ms > 0 && (bestS1MS === 0 || l.sector1_ms < bestS1MS)) bestS1MS = l.sector1_ms;
        if (l.sector2_ms > 0 && (bestS2MS === 0 || l.sector2_ms < bestS2MS)) bestS2MS = l.sector2_ms;
        if (l.sector3_ms > 0 && (bestS3MS === 0 || l.sector3_ms < bestS3MS)) bestS3MS = l.sector3_ms;
      });

      const theoreticalBestMS = bestS1MS > 0 && bestS2MS > 0 && bestS3MS > 0 ? bestS1MS + bestS2MS + bestS3MS : 0;

      return {
        participant: p,
        laps: [...driverLaps].sort((a, b) => a.lap_number - b.lap_number),
        bestLap,
        bestLapTimeMS: bestLap ? bestLap.lap_time_ms : Infinity,
        lastLap: lastCompletedLap,
        lastLapTimeMS,
        totalRaceTimeMS,
        penaltySeconds,
        totalRaceTimeWithPenalties,
        officialPos,
        isDNF,
        isDSQ,
        maxSpeed,
        setup,
        bestS1MS,
        bestS2MS,
        bestS3MS,
        theoreticalBestMS,
      };
    });

    // Sort standings
    if (isRaceSession) {
      driverList.sort((a, b) => {
        if (a.isDSQ !== b.isDSQ) return a.isDSQ ? 1 : -1;
        if (a.isDNF !== b.isDNF) return a.isDNF ? 1 : -1;
        if (b.laps.length !== a.laps.length) return b.laps.length - a.laps.length;

        if (a.officialPos > 0 && b.officialPos > 0) return a.officialPos - b.officialPos;
        if (a.officialPos > 0 && b.officialPos === 0) return -1;
        if (a.officialPos === 0 && b.officialPos > 0) return 1;

        return a.totalRaceTimeWithPenalties - b.totalRaceTimeWithPenalties;
      });
    } else {
      driverList.sort((a, b) => {
        if (a.isDSQ !== b.isDSQ) return a.isDSQ ? 1 : -1;

        const timeA = a.bestLapTimeMS;
        const timeB = b.bestLapTimeMS;

        if (timeA !== Infinity && timeB !== Infinity) {
          if (timeA !== timeB) return timeA - timeB;
        } else if (timeA !== Infinity && timeB === Infinity) {
          return -1;
        } else if (timeA === Infinity && timeB !== Infinity) {
          return 1;
        }

        if (a.officialPos > 0 && b.officialPos > 0) return a.officialPos - b.officialPos;
        if (a.officialPos > 0 && b.officialPos === 0) return -1;
        if (a.officialPos === 0 && b.officialPos > 0) return 1;

        return a.participant.car_index - b.participant.car_index;
      });
    }

    return driverList.map((d, index) => ({
      ...d,
      position: index + 1,
    }));
  }, [selectedSession, participants, laps, setups, isRaceSession]);

  const totalSessionLaps = useMemo(() => {
    if (!laps || laps.length === 0) return 0;
    return laps.reduce((max, l) => (l.lap_time_ms > 0 && l.lap_number > max ? l.lap_number : max), 0);
  }, [laps]);

  const totalDriversCount = Math.max(participants.length, driverStandings.length);

  const hasValidSetup = (setup?: CarSetup) => {
    if (!setup) return false;
    return (
      setup.front_wing > 0 ||
      setup.rear_wing > 0 ||
      setup.brake_pressure > 0 ||
      setup.on_throttle > 0 ||
      setup.ballast > 0
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem' }}>
      {/* Session History Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar color="var(--accent-primary)" size={28} />
            Session Explorer
          </h1>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Historical Session Telemetry, Classification, Progression & Sector Analytics
          </p>
        </div>

        {selectedSession && (
          <button
            className="nav-tab active"
            onClick={() => {
              setSelectedSession(null);
              setSelectedSetupDriver(null);
              setIsAiDebriefOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Back to Sessions List
          </button>
        )}
      </div>

      {/* VIEW 1: SESSION LIST & KPI LANDING */}
      {!selectedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Aggregate KPI Metrics Bar */}
          <SessionKPIBar sessions={sessions} />

          {/* Controls / Filter Bar */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search track, session type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 1rem 0.55rem 2.4rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Session Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={15} color="var(--text-secondary)" />
                <select
                  className="ui-select"
                  value={sessionTypeFilter}
                  onChange={(e) => setSessionTypeFilter(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)', minWidth: '140px', fontSize: '0.85rem' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="Race">Race</option>
                  <option value="Sprint">Sprint</option>
                  <option value="Qualifying">Qualifying</option>
                  <option value="Practice">Practice</option>
                </select>
              </div>

              {/* Circuit Filter */}
              {uniqueCircuits.length > 0 && (
                <select
                  className="ui-select"
                  value={circuitFilter}
                  onChange={(e) => setCircuitFilter(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)', minWidth: '150px', fontSize: '0.85rem' }}
                >
                  <option value="ALL">All Circuits ({uniqueCircuits.length})</option>
                  {uniqueCircuits.map((circ) => (
                    <option key={circ} value={circ}>
                      {circ}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* View Switcher & Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-color)' }}>
                <button
                  className={`nav-tab ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Card Grid View"
                  style={{ padding: '4px 8px', borderRadius: '4px', border: 'none' }}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`nav-tab ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Data Table View"
                  style={{ padding: '4px 8px', borderRadius: '4px', border: 'none' }}
                >
                  <List size={15} />
                </button>
              </div>

              <button
                className="nav-tab"
                onClick={fetchSessions}
                disabled={loadingSessions}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
              >
                <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Session Content Cards / Table */}
          {loadingSessions ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading session history repository...</p>
            </div>
          ) : error ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--accent-primary)' }}>
              <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{error}</p>
              <button className="nav-tab active" onClick={fetchSessions} style={{ marginTop: '1rem' }}>
                Retry
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <Flag size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <h3>No Sessions Found</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {searchQuery || sessionTypeFilter !== 'ALL' || circuitFilter !== 'ALL'
                  ? 'No historical sessions match your current search filters.'
                  : 'No telemetry sessions recorded in the database yet. Launch a session or simulator!'}
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <SessionCardGrid
              sessions={filteredSessions}
              onSelectSession={selectSession}
              onRequestDelete={(s) => setSessionToDelete(s)}
              formatDate={formatDate}
              getSessionBadgeClass={getSessionBadgeClass}
            />
          ) : (
            <SessionTableView
              sessions={filteredSessions}
              onSelectSession={selectSession}
              onRequestDelete={(s) => setSessionToDelete(s)}
              formatDate={formatDate}
              getSessionBadgeClass={getSessionBadgeClass}
              sortField={sortField}
              sortOrder={sortOrder}
              onToggleSort={handleToggleSort}
            />
          )}
        </div>
      )}

      {/* VIEW 2: SELECTED SESSION DETAIL EXPLORER */}
      {selectedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Metadata Card */}
          <div className="glass-panel session-header-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{selectedSession.track_name}</h1>
                <span className={`session-badge ${getSessionBadgeClass(selectedSession.session_type)}`}>
                  {selectedSession.session_type}
                </span>
              </div>
              <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                Recorded on {formatDate(selectedSession.created_at)} • UID: {selectedSession.session_uid || selectedSession.id}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="header-stat-box">
                <CloudSun size={16} color="var(--text-secondary)" />
                <div>
                  <div className="stat-label">WEATHER</div>
                  <div className="stat-value" style={{ fontSize: '0.85rem' }}>
                    {selectedSession.weather || 'Clear'}
                  </div>
                </div>
              </div>

              <div className="header-stat-box">
                <Flag size={16} color="var(--text-secondary)" />
                <div>
                  <div className="stat-label">TOTAL LAPS</div>
                  <div className="stat-value mono">{totalSessionLaps} Laps</div>
                </div>
              </div>

              <div className="header-stat-box">
                <Users size={16} color="var(--text-secondary)" />
                <div>
                  <div className="stat-label">DRIVERS</div>
                  <div className="stat-value mono">{totalDriversCount} Drivers</div>
                </div>
              </div>

              {/* AI Race Engineer Debrief Button */}
              <button
                className="nav-tab active"
                onClick={() => setIsAiDebriefOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.6rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(176, 38, 255, 0.25))',
                  borderColor: 'rgba(0, 242, 254, 0.4)',
                  color: '#fff',
                }}
              >
                <Sparkles size={15} color="#ffd700" /> AI Race Engineer Debrief
              </button>

              <button
                className="nav-tab"
                title="Delete this session"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.6rem 1rem',
                  color: '#ff4d4f',
                  borderColor: 'rgba(255, 77, 79, 0.3)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
                onClick={() => setSessionToDelete(selectedSession)}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs inside Session Detail */}
          <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <button
              className={`nav-tab ${activeDetailTab === 'classification' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('classification')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <Trophy size={16} />
              <span>Classification & Laps</span>
            </button>

            <button
              className={`nav-tab ${activeDetailTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('charts')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <TrendingUp size={16} />
              <span>Lap Progression & Gap Charts</span>
            </button>

            <button
              className={`nav-tab ${activeDetailTab === 'sectors' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('sectors')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <Zap size={16} />
              <span>Sector & Speed Matrix</span>
            </button>
          </div>

          {/* Detail Tab Contents */}
          {loadingDetail ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Retrieving drivers, lap timing telemetry, and setups...</p>
            </div>
          ) : activeDetailTab === 'classification' ? (
            <SessionClassificationTab
              session={selectedSession}
              driverStandings={driverStandings}
              isRaceSession={isRaceSession}
              sessionBestS1={sessionBestS1}
              sessionBestS2={sessionBestS2}
              sessionBestS3={sessionBestS3}
              expandedDrivers={expandedDrivers}
              onToggleDriverExpand={toggleDriverExpand}
              onOpenSetupModal={(driver) => setSelectedSetupDriver(driver)}
              onSendToComparator={onNavigateToComparator}
              formatLapTime={formatLapTime}
              formatTotalDuration={formatTotalDuration}
              renderTyreBadge={renderTyreBadge}
              renderDriverTyreStints={renderDriverTyreStints}
              hasValidSetup={hasValidSetup}
            />
          ) : activeDetailTab === 'charts' ? (
            <SessionLapChartsTab
              driverStandings={driverStandings}
              totalSessionLaps={totalSessionLaps}
              formatLapTime={formatLapTime}
            />
          ) : (
            <SessionSectorMatrixTab
              driverStandings={driverStandings}
              sessionBestS1={sessionBestS1}
              sessionBestS2={sessionBestS2}
              sessionBestS3={sessionBestS3}
              formatLapTime={formatLapTime}
            />
          )}

          {/* CAR SETUP MODAL OVERLAY */}
          {selectedSetupDriver && selectedSetupDriver.setup && (
            <div
              className="modal-overlay"
              onClick={() => setSelectedSetupDriver(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="modal-container glass-panel"
                style={{
                  maxWidth: '650px',
                  backgroundColor: 'rgba(18, 18, 22, 0.95)',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  padding: '1.75rem',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '24px', backgroundColor: TEAM_COLORS[selectedSetupDriver.participant.team_id] || '#A0A0A0', borderRadius: '2px' }} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sliders size={18} color="#00f2fe" /> Car Setup Details — {selectedSetupDriver.participant.name}
                      </h3>
                      <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Car #{selectedSetupDriver.participant.car_index + 1} • Race #{selectedSetupDriver.participant.race_number}
                      </span>
                    </div>
                  </div>

                  <button
                    className="nav-tab"
                    onClick={() => setSelectedSetupDriver(null)}
                    style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
                  {/* Aerodynamics */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Zap size={14} /> Aerodynamics & Wings
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div>Front Wing: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_wing}</span></div>
                      <div>Rear Wing: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.rear_wing}</span></div>
                    </div>
                  </div>

                  {/* Differential */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Sliders size={14} /> Transmission & Differential
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div>On Throttle: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.on_throttle}%</span></div>
                      <div>Off Throttle: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.off_throttle}%</span></div>
                    </div>
                  </div>

                  {/* Suspension & ARB */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Wrench size={14} /> Suspension & Geometry
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div>Suspension (F/R): <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_suspension} / {selectedSetupDriver.setup.rear_suspension}</span></div>
                      <div>Anti-Roll (F/R): <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_anti_roll_bar} / {selectedSetupDriver.setup.rear_anti_roll_bar}</span></div>
                      <div>Camber (F/R): <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_camber}° / {selectedSetupDriver.setup.rear_camber}°</span></div>
                      <div>Toe (F/R): <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_toe}° / {selectedSetupDriver.setup.rear_toe}°</span></div>
                      <div>Ride Height (F/R): <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_suspension_height} / {selectedSetupDriver.setup.rear_suspension_height}</span></div>
                    </div>
                  </div>

                  {/* Brakes */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Shield size={14} /> Brakes
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div>Brake Pressure: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.brake_pressure}%</span></div>
                      <div>Brake Bias: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.brake_bias}%</span></div>
                    </div>
                  </div>

                  {/* Tyres & Weight */}
                  <div>
                    <div style={{ fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Disc size={14} /> Tyres & Fuel Load
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div>Front Pressure: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.front_tyre_pressure} PSI</span></div>
                      <div>Rear Pressure: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.rear_tyre_pressure} PSI</span></div>
                      <div>Ballast: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.ballast} kg</span></div>
                      <div>Fuel Load: <span className="mono" style={{ fontWeight: 700 }}>{selectedSetupDriver.setup.fuel_load?.toFixed(1)} kg</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI RACE ENGINEER DEBRIEF DRAWER */}
          {isAiDebriefOpen && (
            <SessionAiDebriefDrawer
              session={selectedSession}
              driverStandings={driverStandings}
              sessionBestS1={sessionBestS1}
              sessionBestS2={sessionBestS2}
              sessionBestS3={sessionBestS3}
              onClose={() => setIsAiDebriefOpen(false)}
              formatLapTime={formatLapTime}
            />
          )}
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {sessionToDelete && (
        <div className="modal-overlay" onClick={() => setSessionToDelete(null)}>
          <div
            className="modal-container glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ff4d4f' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Confirm Session Deletion</h3>
              </div>
              <button
                onClick={() => setSessionToDelete(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>Session #{sessionToDelete.id} ({sessionToDelete.track_name} — {sessionToDelete.session_type})</strong>?
              This action will permanently delete all associated telemetry samples, lap data, participants, and car setups.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="nav-tab"
                onClick={() => setSessionToDelete(null)}
                disabled={deletingSessionId === sessionToDelete.id}
                style={{ padding: '0.5rem 1.2rem' }}
              >
                Cancel
              </button>
              <button
                className="nav-tab active"
                onClick={confirmDeleteSession}
                disabled={deletingSessionId === sessionToDelete.id}
                style={{
                  padding: '0.5rem 1.2rem',
                  background: 'linear-gradient(135deg, #ff4d4f, #d9363e)',
                  borderColor: '#ff4d4f',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingSessionId === sessionToDelete.id ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Delete Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
