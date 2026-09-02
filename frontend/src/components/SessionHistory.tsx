import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Search,
  Flag,
  ArrowLeft,
  Filter,
  RefreshCw,
  X,
  Trash2,
  AlertTriangle,
  Upload,
  CheckCircle,
} from 'lucide-react';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionClassificationTab } from './session_history/SessionClassificationTab';
import { SessionLapChartsTab } from './session_history/SessionLapChartsTab';
import { SessionStintStrategyTab } from './session_history/SessionStintStrategyTab';
import { SessionSectorMatrixTab } from './session_history/SessionSectorMatrixTab';
import { SessionDetailHeader } from './session_history/SessionDetailHeader';
import { DeleteSessionModal } from './session_history/DeleteSessionModal';
import { TagBadge } from './session_history/TagBadge';
import { TagManagerModal } from './session_history/TagManagerModal';
import { TagFilterBar } from './session_history/TagFilterBar';

import { useRaceEngineerActions } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import { api } from '../utils/apiClient';

import { TyreCompoundBadge } from './common/TyreCompoundBadge';
import {
  formatLapTime,
  formatTotalDuration,
  formatDate,
  getSessionBadgeClass,
} from '../utils/formatters';

import {
  type Session,
  type Participant,
  type Lap,
  type StagedLap,
  type DriverStanding,
  type NavigationComparatorPayload,
  type Tag,
  type ClassificationResponse,
  type ProgressionResponse,
  type StintsResponse,
  normalizeDriverStanding,
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
  const { openChat, setSessionDebriefContext, setContextMode } = useRaceEngineerActions();

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

  // Modal states for batch operations
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState<boolean>(false);
  const [batchSelectedTagId, setBatchSelectedTagId] = useState<number | null>(null);

  // Hook 4: Batch Operations & Import/Export
  const {
    selectedSessionIds,
    isExportingBatch,
    importingSession,
    toastMessage,
    setToastMessage,
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

  const [detailError, setDetailError] = useState<string | null>(null);
  const sessionDetailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      sessionDetailAbortRef.current?.abort();
    };
  }, []);

  const selectSession = async (session: Session) => {
    sessionDetailAbortRef.current?.abort();
    const controller = new AbortController();
    sessionDetailAbortRef.current = controller;
    const { signal } = controller;

    setSelectedSession(session);
    setLoadingDetail(true);
    setDetailError(null);
    setExpandedDrivers({});
    setStagedSlotA(null);
    setStagedSlotB(null);
    setActiveDetailTab('classification');

    try {
      const [classRes, progRes, stintsRes, lapsRes] = await Promise.allSettled([
        api.get<ClassificationResponse>(`/api/sessions/${session.id}/classification`, { signal }),
        api.get<ProgressionResponse>(`/api/sessions/${session.id}/progression`, { signal }),
        api.get<StintsResponse>(`/api/sessions/${session.id}/stints`, { signal }),
        api.get<Lap[]>(`/api/sessions/${session.id}/laps`, { signal }),
      ]);

      if (signal.aborted) return;

      const classData = classRes.status === 'fulfilled' ? classRes.value : null;
      const progData = progRes.status === 'fulfilled' ? progRes.value : null;
      const stintsDataRes = stintsRes.status === 'fulfilled' ? stintsRes.value : null;
      const lapsData = lapsRes.status === 'fulfilled' ? lapsRes.value : [];

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
      if (err.name !== 'AbortError') {
        setDetailError(err.message || 'Error fetching session details');
      }
    } finally {
      if (!signal.aborted) {
        setLoadingDetail(false);
      }
    }
  };

  const toggleDriverExpand = (carIndex: number) => {
    setExpandedDrivers((prev) => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
  };

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
    return <TyreCompoundBadge compound={compoundRaw} actualCompound={actualCompound} className="tyre-badge" />;
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
              <TyreCompoundBadge compound={compound} actualCompound={actualCompound} className="tyre-badge" />
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {count}L
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const isRaceSession = !!selectedSession?.session_type?.toLowerCase().includes('race');

  // Sector Records across entire session (from server classification)
  const sessionBestS1 = classificationData?.session_best_s1_ms ?? 0;
  const sessionBestS2 = classificationData?.session_best_s2_ms ?? 0;
  const sessionBestS3 = classificationData?.session_best_s3_ms ?? 0;

  // Driver standings for selected session (from server classification)
  const driverStandings: DriverStanding[] = useMemo(() => {
    if (!selectedSession || !classificationData?.standings) return [];
    return classificationData.standings.map((s) => normalizeDriverStanding(s, selectedSession.id));
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
          <SessionDetailHeader
            session={selectedSession}
            activeDetailTab={activeDetailTab}
            setActiveDetailTab={setActiveDetailTab}
            totalSessionLaps={totalSessionLaps}
            totalDriversCount={totalDriversCount}
            onOpenAiDebrief={() => openChat()}
            onExportSession={() => handleExportSession(selectedSession)}
            onRequestDelete={() => setSessionToDelete(selectedSession)}
            onOpenTagManager={() => setSessionToManageTags(selectedSession)}
            onRemoveTag={(tagId) => handleRemoveTag(selectedSession.id, tagId)}
            formatDate={formatDate}
            getSessionBadgeClass={getSessionBadgeClass}
          />

          {/* Detail Tab Contents */}
          {detailError && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderColor: 'var(--accent-primary)' }}>
              <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{detailError}</p>
            </div>
          )}
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
      <DeleteSessionModal
        session={sessionToDelete}
        deletingSessionId={deletingSessionId}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={() =>
          confirmDeleteSession(
            (id) => {
              if (selectedSession && selectedSession.id === id) {
                setSelectedSession(null);
              }
              setToastMessage({ type: 'success', text: t('history.batch.deleteSelected', { count: 1 }) });
            },
            (err) => {
              setToastMessage({ type: 'error', text: `${t('history.deleteError') || 'Delete error'}: ${err.message || err}` });
            }
          )
        }
      />

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
                onClick={async () => {
                  await handleExecuteBatchDelete();
                  setShowBatchDeleteModal(false);
                }}
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
                onClick={async () => {
                  if (batchSelectedTagId) {
                    await handleExecuteBatchTag(batchSelectedTagId);
                    setShowBatchTagModal(false);
                    setBatchSelectedTagId(null);
                  }
                }}
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
