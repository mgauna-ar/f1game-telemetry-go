import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Trophy,
  Flag,
  Users,
  ArrowLeft,
  Filter,
  RefreshCw,
  Zap,
  X,
  Trash2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Plus,
  Download,
  Upload,
  CheckCircle,
  Layers,
} from 'lucide-react';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionClassificationTab } from './session_history/SessionClassificationTab';
import { SessionLapChartsTab } from './session_history/SessionLapChartsTab';
import { SessionStintStrategyTab } from './session_history/SessionStintStrategyTab';
import { SessionSectorMatrixTab } from './session_history/SessionSectorMatrixTab';
import { TagBadge } from './session_history/TagBadge';
import { TagManagerModal } from './session_history/TagManagerModal';
import { TagFilterBar } from './session_history/TagFilterBar';
import { F1FormatBadge } from './F1FormatBadge';
import { WeatherBadgeWithForecast } from './session_history/WeatherBadgeWithForecast';
import { TrackFlag } from './TrackFlag';

import { useRaceEngineer } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';

import type {
  Session,
  Participant,
  Lap,
  StagedLap,
  DriverStanding,
  NavigationComparatorPayload,
  Tag,
  ClassificationResponse,
  ProgressionResponse,
  StintsResponse,
} from '../types/session';
import { SessionComparatorDock } from './session_history/SessionComparatorDock';
import { SessionBatchDock } from './session_history/SessionBatchDock';

import { useSessionList } from '../hooks/useSessionList';
import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionTags } from '../hooks/useSessionTags';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { useLapStaging } from '../hooks/useLapStaging';

export type { Session, Participant, Lap, StagedLap, DriverStanding, NavigationComparatorPayload, Tag };

interface SessionHistoryProps {
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onNavigateToComparator }) => {
  const { t } = useI18n();

  // Selected Session Detail state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [classificationData, setClassificationData] = useState<ClassificationResponse | null>(null);
  const [progressionData, setProgressionData] = useState<ProgressionResponse | null>(null);
  const [stintsData, setStintsData] = useState<StintsResponse | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

  // Active Sub-Tab in Session Detail ('classification' | 'charts' | 'stints' | 'sectors')
  const [activeDetailTab, setActiveDetailTab] = useState<'classification' | 'charts' | 'stints' | 'sectors'>('classification');

  // AI Race Engineer Context Hook
  const { openChat, setSessionDebriefContext, setContextMode } = useRaceEngineer();

  // Hook 1: Session list state & deletion
  const {
    sessions,
    setSessions,
    loadingSessions,
    error,
    sessionToDelete,
    setSessionToDelete,
    deletingSessionId,
    fetchSessions,
    confirmDeleteSession,
  } = useSessionList();

  // Hook 2: Tags management
  const {
    availableTags,
    selectedTagId,
    setSelectedTagId,
    sessionToManageTags,
    setSessionToManageTags,
    fetchTags,
    handleAddTag,
    handleRemoveTag,
    handleDeleteGlobalTag,
    sessionCountByTag,
  } = useSessionTags({
    sessions,
    setSessions,
    selectedSession,
    setSelectedSession,
  });

  // Hook 3: Filters, Search & Sorting
  const {
    searchQuery,
    setSearchQuery,
    sessionTypeFilter,
    setSessionTypeFilter,
    circuitFilter,
    setCircuitFilter,
    sortField,
    sortOrder,
    handleToggleSort,
    uniqueCircuits,
    filteredSessions,
  } = useSessionFilters({
    sessions,
    selectedTagId,
  });

  // Hook 4: Batch Operations & Import/Export
  const {
    selectedSessionIds,
    isExportingBatch,
    showBatchDeleteModal,
    setShowBatchDeleteModal,
    showBatchTagModal,
    setShowBatchTagModal,
    batchSelectedTagId,
    setBatchSelectedTagId,
    importingSession,
    toastMessage,
    handleToggleSelectSession,
    handleToggleSelectAll,
    handleClearSelection,
    handleExportSession,
    handleBatchExport,
    handleImportFiles,
    handleExecuteBatchDelete,
    handleExecuteBatchTag,
  } = useBatchOperations({
    sessions,
    filteredSessions,
    setSessions,
    fetchSessions,
    fetchTags,
  });

  // Hook 5: Lap Staging for Comparator Dock
  const {
    stagedSlotA,
    setStagedSlotA,
    stagedSlotB,
    setStagedSlotB,
    handleStageLap,
    handleSwapStagedSlots,
    handleClearStagedA,
    handleClearStagedB,
    handleClearAllStaged,
    handleLaunchComparison,
  } = useLapStaging({
    onNavigateToComparator,
  });

  const selectSession = async (session: Session) => {
    setSelectedSession(session);
    setLoadingDetail(true);
    setExpandedDrivers({});
    setStagedSlotA(null);
    setStagedSlotB(null);
    setActiveDetailTab('classification');

    try {
      const [classRes, progRes, stintsRes, lapsRes] = await Promise.all([
        fetch(`/api/sessions/${session.id}/classification`),
        fetch(`/api/sessions/${session.id}/progression`),
        fetch(`/api/sessions/${session.id}/stints`),
        fetch(`/api/sessions/${session.id}/laps`),
      ]);

      const classData: ClassificationResponse | null = classRes.ok ? await classRes.json() : null;
      const progData: ProgressionResponse | null = progRes.ok ? await progRes.json() : null;
      const stintsDataRes: StintsResponse | null = stintsRes.ok ? await stintsRes.json() : null;
      const lapsData = lapsRes.ok ? await lapsRes.json() : [];

      const normalizedLaps: Lap[] = (lapsData || []).map((l: Lap) => {
        let s3 = l.sector3_ms || 0;
        if (s3 <= 0 && l.lap_time_ms > 0 && l.sector1_ms && l.sector1_ms > 0 && l.sector2_ms && l.sector2_ms > 0) {
          const derived = l.lap_time_ms - (l.sector1_ms + l.sector2_ms);
          if (derived > 0) s3 = derived;
        }
        return { ...l, sector3_ms: s3 };
      });

      setClassificationData(classData);
      setProgressionData(progData);
      setStintsData(stintsDataRes);
      setLaps(normalizedLaps);
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

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
    if (!compoundRaw || compoundRaw.trim() === '') {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const str = compoundRaw.trim().toUpperCase();

    let label = str;
    let color = '#FFFFFF';
    let bg = 'rgba(255, 255, 255, 0.15)';

    if (str === '7' || str.includes('INTER') || str === 'I') {
      label = 'I';
      color = '#33FF33';
      bg = 'rgba(51, 255, 51, 0.15)';
    } else if (str === '16' || str.includes('SOFT') || str === 'S') {
      label = 'S';
      color = '#FF3333';
      bg = 'rgba(255, 51, 51, 0.15)';
    } else if (str === '17' || str.includes('MEDIUM') || str === 'MED' || str === 'M') {
      label = 'M';
      color = '#FFD700';
      bg = 'rgba(255, 215, 0, 0.15)';
    } else if (str === '18' || str.includes('HARD') || str === 'H') {
      label = 'H';
      color = '#FFFFFF';
      bg = 'rgba(255, 255, 255, 0.15)';
    } else if (str === '8' || str.includes('WET') || str === 'W') {
      label = 'W';
      color = '#3399FF';
      bg = 'rgba(51, 153, 255, 0.15)';
    }

    const titleText = actualCompound ? `Tyre: ${compoundRaw} (${actualCompound})` : `Tyre Compound: ${compoundRaw}`;

    return (
      <div
        className="tyre-badge mono"
        title={titleText}
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
    const stints: { compound: string; actualCompound?: string; count: number; stintId: number }[] = [];
    let currentStint: { compound: string; actualCompound?: string; count: number; stintId: number } | null = null;

    sortedLaps.forEach((lap) => {
      const raw = lap.tyre_compound?.trim();
      if (!raw) return;

      const lapStint = lap.stint && lap.stint > 0 ? lap.stint : 0;

      const isNewStint =
        !currentStint ||
        (lapStint > 0 && currentStint.stintId > 0 && lapStint !== currentStint.stintId) ||
        currentStint.compound.toUpperCase() !== raw.toUpperCase();

      if (isNewStint || !currentStint) {
        currentStint = { compound: raw, actualCompound: lap.actual_compound, count: 1, stintId: lapStint };
        stints.push(currentStint);
      } else {
        currentStint.count += 1;
        if (!currentStint.actualCompound && lap.actual_compound) {
          currentStint.actualCompound = lap.actual_compound;
        }
      }
    });

    if (stints.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
        {stints.map(({ compound, actualCompound, count }, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 1px' }}>➔</span>}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {renderTyreBadge(compound, actualCompound)}
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

  const isRaceSession = !!selectedSession?.session_type?.toLowerCase().includes('race');

  // Sector Records across entire session (from server classification)
  const sessionBestS1 = classificationData?.session_best_s1_ms ?? 0;
  const sessionBestS2 = classificationData?.session_best_s2_ms ?? 0;
  const sessionBestS3 = classificationData?.session_best_s3_ms ?? 0;

  // Driver standings for selected session (from server classification)
  const driverStandings: DriverStanding[] = useMemo(() => {
    if (!selectedSession || !classificationData?.standings) return [];

    return classificationData.standings.map((s) => {
      const p: Participant = s.participant || {
        id: s.car_index ?? 0,
        session_id: selectedSession.id,
        car_index: s.car_index ?? 0,
        name: s.driver_name || '',
        driver_id: 0,
        team_id: s.team_id ?? 0,
        race_number: s.race_number ?? 0,
        ai_controlled: s.ai_controlled ?? false,
        position: s.position,
        grid_position: s.grid_position,
        points: s.points,
        result_reason: s.result_reason,
      };
      return {
        ...s,
        participant: p,
        bestLap: s.best_lap || s.bestLap || null,
        bestLapTimeMS: s.best_lap_time_ms ?? s.bestLapTimeMS ?? 0,
        lastLap: s.last_lap || s.lastLap || null,
        lastLapTimeMS: s.last_lap_time_ms ?? s.lastLapTimeMS ?? 0,
        totalRaceTimeMS: s.total_race_time_ms ?? s.totalRaceTimeMS ?? 0,
        totalRaceTimeWithPenalties: s.total_with_penalties_ms ?? s.totalRaceTimeWithPenalties ?? 0,
        penaltySeconds: s.penalty_seconds ?? s.penaltySeconds ?? 0,
        officialPos: s.position,
        gridPosition: s.grid_position,
        positionsGained: s.positions_gained,
        isDNF: s.is_dnf ?? s.isDNF ?? false,
        isDSQ: s.is_dsq ?? s.isDSQ ?? false,
        maxSpeed: s.max_speed ?? s.maxSpeed ?? 0,
        bestS1MS: s.best_s1_ms ?? s.bestS1MS ?? 0,
        bestS2MS: s.best_s2_ms ?? s.bestS2MS ?? 0,
        bestS3MS: s.best_s3_ms ?? s.bestS3MS ?? 0,
        theoreticalBestMS: s.theoretical_best_ms ?? s.theoreticalBestMS ?? 0,
        laps: s.laps || [],
      };
    });
  }, [classificationData, selectedSession]);

  // Helper to format tyre stints for debrief
  const getStintsText = (driverLaps: Lap[]) => {
    if (!driverLaps || driverLaps.length === 0) return 'No stint data';
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

    if (stints.length === 0) return 'Unknown';
    return stints.map((s) => `${s.compound} (${s.count}L)`).join(' ➔ ');
  };

  // Sync Session Debrief context to global AI Race Engineer
  useEffect(() => {
    if (selectedSession && driverStandings.length > 0) {
      const winner = driverStandings[0];
      const fastestLapDriver = [...driverStandings].sort((a, b) => a.bestLapTimeMS - b.bestLapTimeMS)[0];
      const ultimateMS = sessionBestS1 + sessionBestS2 + sessionBestS3;
      const tagsSummary =
        selectedSession.tags && selectedSession.tags.length > 0
          ? selectedSession.tags.map((t) => t.name).join(', ')
          : 'None';

      let summaryText = `SESSION CLASSIFICATION & METRICS:
- Circuit: ${selectedSession.track_name}
- Session Type: ${selectedSession.session_type}
- League / Category Tags: ${tagsSummary}
- Weather: ${selectedSession.weather || 'Clear'}
- Total Drivers in Session: ${driverStandings.length}
- Session Winner / P1: ${winner ? `${winner.participant.name} (#${winner.participant.race_number})` : 'N/A'}
- Fastest Lap of Session: ${fastestLapDriver ? `${fastestLapDriver.participant.name} (${formatLapTime(fastestLapDriver.bestLapTimeMS)})` : 'N/A'}
- Session Record Sectors: S1: ${(sessionBestS1 / 1000).toFixed(3)}s | S2: ${(sessionBestS2 / 1000).toFixed(3)}s | S3: ${(sessionBestS3 / 1000).toFixed(3)}s
- Theoretical Best Lap of Session: ${ultimateMS > 0 ? formatLapTime(ultimateMS) : 'N/A'}

OFFICIAL DRIVER CLASSIFICATION & STINT BREAKDOWN:
`;
      driverStandings.slice(0, 10).forEach((d) => {
        const gapStr =
          d.position === 1
            ? 'WINNER / LEADER'
            : isRaceSession && d.totalRaceTimeWithPenalties && winner?.totalRaceTimeWithPenalties
            ? `+${((d.totalRaceTimeWithPenalties - winner.totalRaceTimeWithPenalties) / 1000).toFixed(3)}s`
            : d.bestLapTimeMS !== Infinity && winner?.bestLapTimeMS !== Infinity
            ? `+${((d.bestLapTimeMS - (winner?.bestLapTimeMS || 0)) / 1000).toFixed(3)}s`
            : '-';
        const userTag = d.participant.ai_controlled ? '(AI)' : '(HUMAN PLAYER)';
        const stintsStr = getStintsText(d.laps);
        summaryText += `- P${d.position}: ${d.participant.name} (#${d.participant.race_number}) ${userTag} | Total Time/Gap: ${gapStr} | Best Lap: ${formatLapTime(d.bestLapTimeMS)} | S1: ${(d.bestS1MS / 1000).toFixed(3)}s, S2: ${(d.bestS2MS / 1000).toFixed(3)}s, S3: ${(d.bestS3MS / 1000).toFixed(3)}s | Max Speed: ${d.maxSpeed.toFixed(1)} km/h | Stints: ${stintsStr} | Laps: ${d.laps.length} | Status: ${d.isDSQ ? 'DSQ' : d.isDNF ? 'DNF' : 'Finished'}\n`;
      });

      setSessionDebriefContext({
        trackName: selectedSession.track_name,
        sessionType: selectedSession.session_type,
        weather: selectedSession.weather,
        driverCount: driverStandings.length,
        summaryText,
      });
      setContextMode('session_debrief');
    } else {
      setSessionDebriefContext(null);
      setContextMode('general');
    }
  }, [selectedSession, driverStandings, sessionBestS1, sessionBestS2, sessionBestS3, isRaceSession, setSessionDebriefContext, setContextMode]);

  const totalSessionLaps = useMemo(() => {
    if (progressionData && progressionData.total_session_laps > 0) {
      return progressionData.total_session_laps;
    }
    if (selectedSession?.total_laps && selectedSession.total_laps > 0) {
      return selectedSession.total_laps;
    }
    if (!laps || laps.length === 0) return 0;
    return laps.reduce((max, l) => (l.lap_time_ms > 0 && l.lap_number > max ? l.lap_number : max), 0);
  }, [progressionData, selectedSession, laps]);

  const totalDriversCount = driverStandings.length;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem' }}>
      {/* Session History Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar color="var(--accent-primary)" size={28} />
            {t('history.title')}
          </h1>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {t('history.subtitle')}
          </p>
        </div>

        {selectedSession && (
          <button
            className="nav-tab active"
            onClick={() => {
              setSelectedSession(null);
              setStagedSlotA(null);
              setStagedSlotB(null);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> {t('history.backToList')}
          </button>
        )}
      </div>

      {/* VIEW 1: SESSION LIST & FILTER TOOLBAR */}
      {!selectedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Controls / Filter Bar */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={t('history.searchPlaceholder')}
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
                  <option value="ALL">{t('history.allTypes')}</option>
                  <option value="Race">{t('history.race')}</option>
                  <option value="Sprint">{t('history.sprint')}</option>
                  <option value="Qualifying">{t('history.qualifying')}</option>
                  <option value="Practice">{t('history.practice')}</option>
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
                  <option value="ALL">{t('history.allCircuits', { count: uniqueCircuits.length })}</option>
                  {uniqueCircuits.map((circ) => (
                    <option key={circ} value={circ}>
                      {circ}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Import & Refresh Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Import Session Button */}
              <label
                className="nav-tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  padding: '0.55rem 0.9rem',
                  cursor: importingSession ? 'not-allowed' : 'pointer',
                  background: 'rgba(0, 242, 254, 0.08)',
                  borderColor: 'rgba(0, 242, 254, 0.3)',
                  color: 'var(--accent-secondary)',
                }}
                title={t('history.importDropPrompt')}
              >
                <input
                  type="file"
                  multiple
                  accept=".f1session,.zip"
                  style={{ display: 'none' }}
                  disabled={importingSession}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleImportFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                {importingSession ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> {t('history.importing')}
                  </>
                ) : (
                  <>
                    <Upload size={14} /> {t('history.importSession')}
                  </>
                )}
              </label>

              <button
                className="nav-tab"
                onClick={() => {
                  fetchSessions();
                  fetchTags();
                }}
                disabled={loadingSessions}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
              >
                <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> {t('common.refresh')}
              </button>
            </div>

            {/* Tag Filter Bar Strip */}
            {availableTags.length > 0 && (
              <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem', marginTop: '0.25rem' }}>
                <TagFilterBar
                  availableTags={availableTags}
                  selectedTagId={selectedTagId}
                  onSelectTag={setSelectedTagId}
                  sessionCountByTag={sessionCountByTag}
                  totalSessionsCount={sessions.length}
                />
              </div>
            )}
          </div>

          {/* Session Content Table */}
          {loadingSessions ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                {t('history.loadingRepo')}
              </p>
            </div>
          ) : error ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--accent-primary)' }}>
              <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{error}</p>
              <button className="nav-tab active" onClick={fetchSessions} style={{ marginTop: '1rem' }}>
                {t('common.retry')}
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <Flag size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <h3>{t('history.noSessionsFound')}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {searchQuery || sessionTypeFilter !== 'ALL' || circuitFilter !== 'ALL' || selectedTagId !== null
                  ? t('history.noSessionsMatch')
                  : t('history.noSessionsEmpty')}
              </p>
            </div>
          ) : (
            <SessionTableView
              sessions={filteredSessions}
              selectedSessionIds={selectedSessionIds}
              onToggleSelectSession={handleToggleSelectSession}
              onToggleSelectAll={handleToggleSelectAll}
              onSelectSession={selectSession}
              onRequestDelete={(s) => setSessionToDelete(s)}
              onExportSession={handleExportSession}
              formatDate={formatDate}
              getSessionBadgeClass={getSessionBadgeClass}
              sortField={sortField}
              sortOrder={sortOrder}
              onToggleSort={handleToggleSort}
              onOpenTagManager={(s) => setSessionToManageTags(s)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <TrackFlag track={selectedSession.track_name} width={26} height={18} />
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{selectedSession.track_name}</h1>
                <F1FormatBadge format={selectedSession.packet_format} size="sm" />
                <span className={`session-badge ${getSessionBadgeClass(selectedSession.session_type)}`}>
                  {selectedSession.session_type}
                </span>
              </div>

              <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                {t('history.detail.recordedOn', { date: formatDate(selectedSession.created_at) })}
              </p>

              {/* Tags & Manage Tags Button */}
              <div className="session-card-tags-row" style={{ paddingTop: '6px' }}>
                {(selectedSession.tags || []).map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    onRemove={() => handleRemoveTag(selectedSession.id, tag.id)}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setSessionToManageTags(selectedSession)}
                  className="session-add-tag-btn"
                  title={t('history.tags.manageTags')}
                >
                  <Plus size={12} />
                  <span>{(selectedSession.tags || []).length === 0 ? t('history.tags.addTag') : t('history.tags.manageTags')}</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="header-stat-box">
                <div>
                  <div className="stat-label">{t('history.detail.weather')}</div>
                  <WeatherBadgeWithForecast session={selectedSession} />
                </div>
              </div>

              <div className="header-stat-box">
                <Flag size={16} color="var(--text-secondary)" />
                <div>
                  <div className="stat-label">{t('history.detail.totalLaps')}</div>
                  <div className="stat-value mono">{t('history.detail.lapsCount', { count: totalSessionLaps })}</div>
                </div>
              </div>

              <div className="header-stat-box">
                <Users size={16} color="var(--text-secondary)" />
                <div>
                  <div className="stat-label">{t('history.detail.drivers')}</div>
                  <div className="stat-value mono">{t('history.detail.driversCount', { count: totalDriversCount })}</div>
                </div>
              </div>

              {/* AI Race Engineer Debrief Button */}
              <button
                className="nav-tab active"
                onClick={() => openChat()}
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
                <Sparkles size={15} color="#ffd700" /> {t('history.detail.aiDebrief')}
              </button>

              {/* Export Session Button */}
              <button
                className="nav-tab"
                title={t('history.detail.exportThis')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.6rem 1rem',
                  color: 'var(--accent-secondary)',
                  borderColor: 'rgba(0, 242, 254, 0.3)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
                onClick={() => handleExportSession(selectedSession)}
              >
                <Download size={15} /> {t('common.export')}
              </button>

              <button
                className="nav-tab"
                title={t('history.detail.deleteThis')}
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
                <Trash2 size={15} /> {t('common.delete')}
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
              <span>{t('history.detail.tabClassification')}</span>
            </button>

            <button
              className={`nav-tab ${activeDetailTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('charts')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <TrendingUp size={16} />
              <span>{t('history.detail.tabProgression')}</span>
            </button>

            <button
              className={`nav-tab ${activeDetailTab === 'stints' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('stints')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <Layers size={16} />
              <span>{t('history.detail.tabStints')}</span>
            </button>

            <button
              className={`nav-tab ${activeDetailTab === 'sectors' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('sectors')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
            >
              <Zap size={16} />
              <span>{t('history.detail.tabSectors')}</span>
            </button>
          </div>

          {/* Detail Tab Contents */}
          {loadingDetail ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                {t('history.detail.retrievingData')}
              </p>
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
              stagedA={stagedSlotA}
              stagedB={stagedSlotB}
              onStageLap={(lap, driver, slot) => handleStageLap(selectedSession, lap, driver, slot)}
              onSendToComparator={onNavigateToComparator}
              formatLapTime={formatLapTime}
              formatTotalDuration={formatTotalDuration}
              renderTyreBadge={renderTyreBadge}
              renderDriverTyreStints={renderDriverTyreStints}
            />
          ) : activeDetailTab === 'charts' ? (
            <SessionLapChartsTab
              progressionData={progressionData}
              driverStandings={driverStandings}
              totalSessionLaps={totalSessionLaps}
              formatLapTime={formatLapTime}
              isRaceSession={isRaceSession}
            />
          ) : activeDetailTab === 'stints' ? (
            <SessionStintStrategyTab
              stintsData={stintsData}
              driverStandings={driverStandings}
              totalSessionLaps={totalSessionLaps}
              formatLapTime={formatLapTime}
              renderTyreBadge={renderTyreBadge}
            />
          ) : (
            <SessionSectorMatrixTab
              classificationData={classificationData}
              driverStandings={driverStandings}
              sessionBestS1={sessionBestS1}
              sessionBestS2={sessionBestS2}
              sessionBestS3={sessionBestS3}
              formatLapTime={formatLapTime}
            />
          )}
        </div>
      )}

      {/* SESSION BATCH ACTION DOCK */}
      {!selectedSession && (
        <SessionBatchDock
          selectedCount={selectedSessionIds.size}
          isExporting={isExportingBatch}
          onExportZip={handleBatchExport}
          onOpenBatchTagModal={() => setShowBatchTagModal(true)}
          onRequestBatchDelete={() => setShowBatchDeleteModal(true)}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* COMPARATOR STAGING DOCK */}
      <SessionComparatorDock
        stagedA={stagedSlotA}
        stagedB={stagedSlotB}
        onClearA={handleClearStagedA}
        onClearB={handleClearStagedB}
        onClearAll={handleClearAllStaged}
        onSwap={handleSwapStagedSlots}
        onLaunch={handleLaunchComparison}
        formatLapTime={formatLapTime}
      />

      {/* CONFIRM SINGLE DELETE MODAL */}
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
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {t('history.modal.confirmTitle')}
                </h3>
              </div>
              <button
                onClick={() => setSessionToDelete(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              {t('history.modal.confirmBody', {
                id: sessionToDelete.id,
                track: sessionToDelete.track_name,
                type: sessionToDelete.session_type,
              })}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="nav-tab"
                onClick={() => setSessionToDelete(null)}
                disabled={deletingSessionId === sessionToDelete.id}
                style={{ padding: '0.5rem 1.2rem' }}
              >
                {t('common.cancel')}
              </button>
              <button
                className="nav-tab active"
                onClick={() =>
                  confirmDeleteSession((id) => {
                    if (selectedSession && selectedSession.id === id) {
                      setSelectedSession(null);
                    }
                  })
                }
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
                    <RefreshCw size={14} className="animate-spin" /> {t('common.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> {t('common.deleteSession')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BATCH DELETE MODAL */}
      {showBatchDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowBatchDeleteModal(false)}>
          <div
            className="modal-container glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ff4d4f' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {t('history.batch.confirmDeleteTitle')}
                </h3>
              </div>
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              {t('history.batch.confirmDeleteBody', { count: selectedSessionIds.size })}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="nav-tab"
                onClick={() => setShowBatchDeleteModal(false)}
                style={{ padding: '0.5rem 1.2rem' }}
              >
                {t('common.cancel')}
              </button>
              <button
                className="nav-tab active"
                onClick={handleExecuteBatchDelete}
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
                <Trash2 size={14} /> {t('history.batch.deleteSelected', { count: selectedSessionIds.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH TAG ASSIGNMENT MODAL */}
      {showBatchTagModal && (
        <div className="modal-overlay" onClick={() => setShowBatchTagModal(false)}>
          <div
            className="modal-container glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.75rem', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--accent-secondary)' }}>
                <TagBadge tag={{ id: 0, name: 'TAGS', color: '#00f2fe' }} size="xs" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {t('history.batch.tagModalTitle', { count: selectedSessionIds.size })}
                </h3>
              </div>
              <button
                onClick={() => setShowBatchTagModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                {t('history.batch.tagSelectPlaceholder')}
              </p>
              {availableTags.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('history.tags.noTagsAvailable')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableTags.map((tag) => {
                    const isSelected = batchSelectedTagId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setBatchSelectedTagId(isSelected ? null : tag.id)}
                        style={{
                          background: isSelected ? tag.color : 'rgba(255, 255, 255, 0.05)',
                          color: isSelected ? '#000' : 'var(--text-primary)',
                          border: `1px solid ${tag.color}`,
                          borderRadius: '20px',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isSelected ? '#000' : tag.color,
                          }}
                        />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="nav-tab"
                onClick={() => {
                  setShowBatchTagModal(false);
                  setBatchSelectedTagId(null);
                }}
                style={{ padding: '0.5rem 1.2rem' }}
              >
                {t('common.cancel')}
              </button>
              <button
                className="nav-tab active"
                disabled={!batchSelectedTagId}
                onClick={handleExecuteBatchTag}
                style={{
                  padding: '0.5rem 1.2rem',
                  opacity: batchSelectedTagId ? 1 : 0.5,
                  cursor: batchSelectedTagId ? 'pointer' : 'not-allowed',
                }}
              >
                {t('history.batch.applyTag')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAG MANAGER MODAL */}
      <TagManagerModal
        session={sessionToManageTags}
        availableTags={availableTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onDeleteGlobalTag={handleDeleteGlobalTag}
        isOpen={sessionToManageTags !== null}
        onClose={() => setSessionToManageTags(null)}
      />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '2rem',
            zIndex: 1000,
            background:
              toastMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : toastMessage.type === 'info'
                ? 'rgba(0, 242, 254, 0.95)'
                : 'rgba(239, 68, 68, 0.95)',
            color: toastMessage.type === 'info' ? '#000' : '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
