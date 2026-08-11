import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
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
  Clock,
  Zap,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { TEAM_COLORS } from './LeaderboardTower';

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

interface DriverStanding {
  position: number;
  participant: Participant;
  laps: Lap[];
  bestLap: Lap | null;
  bestLapTimeMS: number;
  totalRaceTimeMS: number;
  penaltySeconds: number;
  totalRaceTimeWithPenalties: number;
  officialPos: number;
  isDNF: boolean;
  isDSQ: boolean;
  maxSpeed: number;
  setup?: CarSetup;
}

export const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('ALL');

  // Selected Session Detail state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [setups, setSetups] = useState<CarSetup[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

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

      setSessions(prev => prev.filter(s => s.id !== targetId));
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

  const exportGhostLap = (lapId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    window.open(`/api/laps/${lapId}/export`, '_blank');
  };

  const toggleDriverExpand = (carIndex: number) => {
    setExpandedDrivers(prev => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
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

  const renderDriverTyreStints = (laps: Lap[]) => {
    if (!laps || laps.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const compoundCounts: { compound: string; count: number }[] = [];
    laps.forEach(lap => {
      const raw = lap.tyre_compound?.trim();
      if (!raw) return;
      const existing = compoundCounts.find(c => c.compound.toUpperCase() === raw.toUpperCase());
      if (existing) {
        existing.count += 1;
      } else {
        compoundCounts.push({ compound: raw, count: 1 });
      }
    });

    if (compoundCounts.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {compoundCounts.map(({ compound, count }, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {renderTyreBadge(compound)}
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {count}L
            </span>
          </div>
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
    if (lower.includes('race')) return 'badge-red';
    if (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) return 'badge-purple';
    if (lower.includes('practice') || lower.includes('fp')) return 'badge-green';
    return 'badge-gray';
  };

  // Session filtering logic
  const filteredSessions = sessions.filter(s => {
    const matchesSearch =
      !searchQuery ||
      s.track_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.session_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(s.id).includes(searchQuery);

    const matchesType =
      sessionTypeFilter === 'ALL' ||
      s.session_type.toLowerCase().includes(sessionTypeFilter.toLowerCase());

    return matchesSearch && matchesType;
  });

  const isRaceSession = selectedSession?.session_type?.toLowerCase().includes('race');

  // Driver standings calculation for selected session
  const driverStandings: DriverStanding[] = React.useMemo(() => {
    if (!selectedSession) return [];

    // Group laps by car_index
    const lapsByCar: Record<number, Lap[]> = {};
    laps.forEach(l => {
      if (!lapsByCar[l.car_index]) lapsByCar[l.car_index] = [];
      lapsByCar[l.car_index].push(l);
    });

    // Map participants
    const driverList = (participants.length > 0
      ? participants
      : Object.keys(lapsByCar).map(idxStr => ({
          id: Number(idxStr),
          session_id: selectedSession.id,
          car_index: Number(idxStr),
          name: `Driver ${Number(idxStr) + 1}`,
          driver_id: 0,
          team_id: 0,
          race_number: Number(idxStr) + 1,
          ai_controlled: false,
        }))
    ).map(p => {
      const driverLaps = lapsByCar[p.car_index] || [];
      const validLaps = driverLaps.filter(l => l.is_valid && l.lap_time_ms > 0);

      let bestLap: Lap | null = null;
      if (validLaps.length > 0) {
        bestLap = validLaps.reduce((prev, curr) => (curr.lap_time_ms < prev.lap_time_ms ? curr : prev), validLaps[0]);
      } else if (driverLaps.length > 0) {
        bestLap = driverLaps.reduce((prev, curr) => (curr.lap_time_ms < prev.lap_time_ms ? curr : prev), driverLaps[0]);
      }

      const totalRaceTimeMS = driverLaps.reduce((acc, l) => acc + (l.lap_time_ms > 0 ? l.lap_time_ms : 0), 0);
      const penaltySeconds = driverLaps.reduce((maxPen, l) => Math.max(maxPen, l.penalties_seconds || 0), 0);
      const totalRaceTimeWithPenalties = totalRaceTimeMS + penaltySeconds * 1000;
      const lastLap = driverLaps.length > 0 ? driverLaps[driverLaps.length - 1] : null;
      const officialPos = lastLap && lastLap.car_position && lastLap.car_position > 0 ? lastLap.car_position : 0;
      const resStatus = lastLap && lastLap.result_status !== undefined ? lastLap.result_status : 0;
      const isDSQ = resStatus === 5;
      const isDNF = resStatus === 4 || resStatus === 6 || resStatus === 7;

      const maxSpeed = driverLaps.reduce((max, l) => Math.max(max, l.max_speed_kmh || 0), 0);
      const setup = setups.find(s => s.car_index === p.car_index);

      return {
        participant: p,
        laps: driverLaps.sort((a, b) => a.lap_number - b.lap_number),
        bestLap,
        bestLapTimeMS: bestLap ? bestLap.lap_time_ms : Infinity,
        totalRaceTimeMS,
        penaltySeconds,
        totalRaceTimeWithPenalties,
        officialPos,
        isDNF,
        isDSQ,
        maxSpeed,
        setup,
      };
    });

    // Sort: if Race, by official F1 position, laps completed, and total race time including penalties
    if (isRaceSession) {
      driverList.sort((a, b) => {
        if (a.officialPos > 0 && b.officialPos > 0) {
          return a.officialPos - b.officialPos;
        }
        if (b.laps.length !== a.laps.length) return b.laps.length - a.laps.length;
        return a.totalRaceTimeWithPenalties - b.totalRaceTimeWithPenalties;
      });
    } else {
      driverList.sort((a, b) => {
        const timeA = a.bestLapTimeMS;
        const timeB = b.bestLapTimeMS;
        if (timeA !== Infinity && timeB !== Infinity) {
          if (timeA !== timeB) return timeA - timeB;
          return a.participant.car_index - b.participant.car_index;
        }
        if (timeA !== Infinity) return -1;
        if (timeB !== Infinity) return 1;
        return a.participant.car_index - b.participant.car_index;
      });
    }

    return driverList.map((d, index) => ({
      ...d,
      position: index + 1,
    }));
  }, [selectedSession, participants, laps, setups, isRaceSession]);

  const leaderBestLapMS = driverStandings.length > 0 ? driverStandings[0].bestLapTimeMS : Infinity;
  const leaderTotalRaceTimeMS = driverStandings.length > 0 ? driverStandings[0].totalRaceTimeMS : Infinity;

  // Overall session statistics: max completed race lap number
  const totalSessionLaps = React.useMemo(() => {
    if (!laps || laps.length === 0) return 0;
    return laps.reduce((max, l) => (l.lap_number > max ? l.lap_number : max), 0);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar color="var(--accent-primary)" size={28} />
            Session Explorer
          </h1>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Historical Session Telemetry, Standings, Car Setups & Ghost Laps
          </p>
        </div>

        {selectedSession && (
          <button
            className="nav-tab active"
            onClick={() => {
              setSelectedSession(null);
              setSelectedSetupDriver(null);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> Back to Sessions List
          </button>
        )}
      </div>

      {/* VIEW 1: SESSION LIST & FILTERING */}
      {!selectedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Controls / Filter Bar */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search track name, session type..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem 0.6rem 2.5rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Filter size={16} color="var(--text-secondary)" />
                <select
                  className="ui-select"
                  value={sessionTypeFilter}
                  onChange={e => setSessionTypeFilter(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)', minWidth: '150px' }}
                >
                  <option value="ALL">All Session Types</option>
                  <option value="Race">Race</option>
                  <option value="Qualifying">Qualifying</option>
                  <option value="Practice">Practice</option>
                </select>
              </div>
            </div>

            <button
              className="nav-tab"
              onClick={fetchSessions}
              disabled={loadingSessions}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> Refresh List
            </button>
          </div>

          {/* Session Cards / Table */}
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
                {searchQuery || sessionTypeFilter !== 'ALL'
                  ? 'No historical sessions match your search filters.'
                  : 'No telemetry sessions recorded in the database yet. Launch a session or simulator!'}
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Date & Time</th>
                    <th>Track Name</th>
                    <th>Session Type</th>
                    <th>Weather</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(session => (
                    <tr
                      key={session.id}
                      onClick={() => selectSession(session)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                        #{session.id}
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          {formatDate(session.created_at)}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{session.track_name || 'Unknown Track'}</span>
                      </td>
                      <td>
                        <span className={`session-badge ${getSessionBadgeClass(session.session_type)}`}>
                          {session.session_type || 'RACE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <CloudSun size={14} color="var(--text-secondary)" />
                          {session.weather || 'Clear'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="nav-tab active"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={e => {
                              e.stopPropagation();
                              selectSession(session);
                            }}
                          >
                            Explore <ChevronRight size={14} />
                          </button>
                          <button
                            className="nav-tab"
                            title={`Delete Session #${session.id}`}
                            style={{
                              padding: '0.4rem 0.6rem',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#ff4d4f',
                              borderColor: 'rgba(255, 77, 79, 0.3)',
                            }}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSessionToDelete(session);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <div className="stat-value" style={{ fontSize: '0.85rem' }}>{selectedSession.weather || 'Clear'}</div>
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
                <Trash2 size={15} /> Delete Session
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Retrieving drivers, lap timing telemetry, and setups...</p>
            </div>
          ) : (
            /* STANDINGS & EXPANDABLE LAPS TABLE */
            <div className="glass-panel" style={{ padding: '1rem' }}>
              <h3 style={{ margin: '0.5rem 0 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} color="var(--accent-primary)" />
                {isRaceSession ? 'Race Standings & Total Race Time' : 'Session Standings & Delta Timing'}
              </h3>

              {driverStandings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No lap timing data recorded for this session.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>POS</th>
                        <th>DRIVER</th>
                        <th>SETUP</th>
                        <th>BEST LAP</th>
                        <th>DELTA</th>
                        <th>{isRaceSession ? 'TOTAL RACE TIME' : 'TOTAL TIME'}</th>
                        <th>MAX SPEED</th>
                        <th>TYRE</th>
                        <th style={{ textAlign: 'right' }}>DETAILS / EXPORT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverStandings.map(driver => {
                        const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';
                        const isExpanded = !!expandedDrivers[driver.participant.car_index];

                        const isLeader = driver.position === 1;
                        let deltaStr = '--';
                        if (isRaceSession) {
                          if (driver.isDSQ) {
                            deltaStr = 'DSQ';
                          } else if (driver.isDNF) {
                            deltaStr = 'DNF';
                          } else if (isLeader) {
                            deltaStr = 'LEADER';
                          } else if (driverStandings.length > 0) {
                            const leaderLaps = driverStandings[0].laps.length;
                            const driverLapsCount = driver.laps.length;
                            if (leaderLaps > 0 && driverLapsCount < leaderLaps) {
                              const lapDiff = leaderLaps - driverLapsCount;
                              deltaStr = `+${lapDiff} ${lapDiff === 1 ? 'Lap' : 'Laps'}`;
                            } else if (driver.totalRaceTimeWithPenalties > 0 && driverStandings[0].totalRaceTimeWithPenalties > 0) {
                              const gapMS = driver.totalRaceTimeWithPenalties - driverStandings[0].totalRaceTimeWithPenalties;
                              deltaStr = gapMS >= 0 ? `+${(gapMS / 1000).toFixed(3)}s` : `+0.000s`;
                            }
                          }
                        } else {
                          if (isLeader) {
                            deltaStr = 'LEADER';
                          } else if (driver.bestLapTimeMS < Infinity && leaderBestLapMS < Infinity) {
                            const delta = (driver.bestLapTimeMS - leaderBestLapMS) / 1000;
                            deltaStr = `+${delta.toFixed(3)}s`;
                          }
                        }

                        return (
                          <React.Fragment key={driver.participant.car_index}>
                            {/* Primary Driver Row */}
                            <tr
                              onClick={() => toggleDriverExpand(driver.participant.car_index)}
                              style={{ cursor: 'pointer' }}
                            >
                              {/* Position */}
                              <td>
                                <div
                                  className="mono"
                                  style={{
                                    fontWeight: 700,
                                    color: driver.position <= 3 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                  }}
                                >
                                  P{driver.position}
                                </div>
                              </td>

                              {/* Driver Name & Race Number */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '4px', height: '22px', backgroundColor: teamColor, borderRadius: '2px' }} />
                                  <div>
                                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {driver.participant.name}
                                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        #{driver.participant.race_number}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Car Setup Icon Button next to Driver */}
                              <td>
                                {hasValidSetup(driver.setup) ? (
                                  <button
                                    className="nav-tab"
                                    title={`View Setup for ${driver.participant.name}`}
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedSetupDriver(driver);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: '0.75rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: 'rgba(0, 242, 254, 0.1)',
                                      borderColor: 'rgba(0, 242, 254, 0.3)',
                                      color: '#00f2fe',
                                    }}
                                  >
                                    <Sliders size={13} /> Setup
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                                )}
                              </td>

                              {/* Best Lap Time */}
                              <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-tertiary)' }}>
                                {driver.bestLap ? formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
                              </td>

                              {/* Delta Time */}
                              <td className="mono" style={{ fontWeight: 700, color: driver.isDSQ || driver.isDNF ? '#ff4d4f' : isLeader ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                {deltaStr}
                              </td>

                              {/* Total Race Time / Total Duration */}
                              <td className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Clock size={12} color="var(--text-secondary)" />
                                  {driver.isDSQ ? 'DSQ' : driver.isDNF ? 'DNF' : formatTotalDuration(driver.totalRaceTimeMS)}
                                  {driver.penaltySeconds > 0 && (
                                    <span
                                      className="mono"
                                      title={`${driver.penaltySeconds}s Penalty Included`}
                                      style={{
                                        backgroundColor: 'rgba(255, 77, 79, 0.15)',
                                        color: '#ff4d4f',
                                        border: '1px solid rgba(255, 77, 79, 0.4)',
                                        borderRadius: '3px',
                                        padding: '1px 5px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                      }}
                                    >
                                      +{driver.penaltySeconds}s Pen
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Max Speed */}
                              <td className="mono">
                                {driver.maxSpeed ? `${driver.maxSpeed.toFixed(1)} km/h` : '-- km/h'}
                              </td>

                              {/* Tyre Compound Stints */}
                              <td>
                                {renderDriverTyreStints(driver.laps)}
                              </td>

                              {/* Details & Export Actions */}
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  {driver.bestLap && (
                                    <button
                                      className="nav-tab"
                                      title="Export Best Ghost Lap"
                                      onClick={e => exportGhostLap(driver.bestLap!.id, e)}
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <Download size={12} /> Ghost
                                    </button>
                                  )}
                                  <button
                                    className="nav-tab"
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleDriverExpand(driver.participant.car_index);
                                    }}
                                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    {driver.laps.length} Laps {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Driver Laps Sub-Table (Expanded View) */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} style={{ background: 'rgba(0, 0, 0, 0.5)', padding: '0.75rem 1rem' }}>
                                  <div style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Clock size={14} /> Recorded Laps for {driver.participant.name}
                                    </div>
                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                          <th style={{ padding: '4px 8px' }}>Lap #</th>
                                          <th style={{ padding: '4px 8px' }}>Lap Time</th>
                                          <th style={{ padding: '4px 8px' }}>Cumulative Time</th>
                                          <th style={{ padding: '4px 8px' }}>Delta to Best</th>
                                          <th style={{ padding: '4px 8px' }}>Max Speed</th>
                                          <th style={{ padding: '4px 8px' }}>Tyre</th>
                                          <th style={{ padding: '4px 8px' }}>Status</th>
                                          <th style={{ padding: '4px 8px', textAlign: 'right' }}>Ghost Lap Export</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(() => {
                                          let runningRaceTime = 0;
                                          return driver.laps.map(lap => {
                                            if (lap.lap_time_ms > 0) runningRaceTime += lap.lap_time_ms;

                                            const lapDeltaToBest = driver.bestLap
                                              ? lap.lap_time_ms === driver.bestLap.lap_time_ms
                                                ? 'PERSONAL BEST'
                                                : `+${((lap.lap_time_ms - driver.bestLap.lap_time_ms) / 1000).toFixed(3)}s`
                                              : '--';

                                            return (
                                              <tr key={lap.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td className="mono" style={{ padding: '6px 8px', fontWeight: 700 }}>
                                                  Lap {lap.lap_number}
                                                </td>
                                                <td className="mono" style={{ padding: '6px 8px', color: lap.id === driver.bestLap?.id ? 'var(--accent-tertiary)' : 'inherit' }}>
                                                  {formatLapTime(lap.lap_time_ms)}
                                                </td>
                                                <td className="mono" style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                                                  {formatTotalDuration(runningRaceTime)}
                                                </td>
                                                <td className="mono" style={{ padding: '6px 8px', color: lapDeltaToBest === 'PERSONAL BEST' ? 'var(--accent-tertiary)' : 'var(--text-muted)' }}>
                                                  {lapDeltaToBest}
                                                </td>
                                                <td className="mono" style={{ padding: '6px 8px' }}>
                                                  {lap.max_speed_kmh ? `${lap.max_speed_kmh.toFixed(1)} km/h` : '-'}
                                                </td>
                                                <td style={{ padding: '6px 8px' }}>
                                                  {renderTyreBadge(lap.tyre_compound)}
                                                </td>
                                                <td style={{ padding: '6px 8px' }}>
                                                  <span className={`session-badge ${lap.is_valid ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                                                    {lap.is_valid ? 'VALID' : 'INVALID'}
                                                  </span>
                                                </td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                                  <button
                                                    className="nav-tab active"
                                                    onClick={e => exportGhostLap(lap.id, e)}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                  >
                                                    <Download size={10} /> Export JSON
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          });
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CAR SETUP MODAL OVERLAY */}
          {selectedSetupDriver && selectedSetupDriver.setup && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
              }}
              onClick={() => setSelectedSetupDriver(null)}
            >
              <div
                className="glass-panel"
                style={{
                  maxWidth: '650px',
                  width: '100%',
                  backgroundColor: 'rgba(18, 18, 22, 0.95)',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  padding: '1.75rem',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                }}
                onClick={e => e.stopPropagation()}
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
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {sessionToDelete && (
        <div className="modal-overlay" onClick={() => setSessionToDelete(null)}>
          <div
            className="modal-container glass-panel"
            onClick={e => e.stopPropagation()}
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
