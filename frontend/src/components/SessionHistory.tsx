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
} from 'lucide-react';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionClassificationTab } from './session_history/SessionClassificationTab';
import { SessionLapChartsTab } from './session_history/SessionLapChartsTab';
import { SessionSectorMatrixTab } from './session_history/SessionSectorMatrixTab';
import { TagBadge } from './session_history/TagBadge';
import { TagManagerModal } from './session_history/TagManagerModal';
import { TagFilterBar } from './session_history/TagFilterBar';
import { F1FormatBadge } from './F1FormatBadge';
import { WeatherBadgeWithForecast } from './session_history/WeatherBadgeWithForecast';
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
} from '../types/session';
import { SessionComparatorDock } from './session_history/SessionComparatorDock';

export type { Session, Participant, Lap, StagedLap, DriverStanding, NavigationComparatorPayload, Tag };

interface SessionHistoryProps {
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onNavigateToComparator }) => {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Import / Export & Toast State
  const [importingSession, setImportingSession] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tags State
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [sessionToManageTags, setSessionToManageTags] = useState<Session | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('ALL');
  const [circuitFilter, setCircuitFilter] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected Session Detail state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

  // Staged Laps for Comparator Dock
  const [stagedSlotA, setStagedSlotA] = useState<StagedLap | null>(null);
  const [stagedSlotB, setStagedSlotB] = useState<StagedLap | null>(null);

  // Active Sub-Tab in Session Detail ('classification' | 'charts' | 'sectors')
  const [activeDetailTab, setActiveDetailTab] = useState<'classification' | 'charts' | 'sectors'>('classification');

  // AI Race Engineer Context Hook
  const { openChat, setSessionDebriefContext, setContextMode } = useRaceEngineer();

  // Staged Lap Handlers
  const handleStageLap = (lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => {
    if (!selectedSession) return;
    const staged: StagedLap = {
      sessionId: selectedSession.id,
      sessionName: selectedSession.track_name,
      lapId: lap.id,
      lapNumber: lap.lap_number,
      lapTimeMS: lap.lap_time_ms,
      driverName: driver.participant.name,
      teamId: driver.participant.team_id,
      raceNumber: driver.participant.race_number,
      tyreCompound: lap.tyre_compound,
    };

    if (slot === 'A') {
      if (stagedSlotA?.lapId === lap.id) {
        setStagedSlotA(null);
      } else {
        setStagedSlotA(staged);
      }
    } else {
      if (stagedSlotB?.lapId === lap.id) {
        setStagedSlotB(null);
      } else {
        setStagedSlotB(staged);
      }
    }
  };

  const handleSwapStagedSlots = () => {
    const temp = stagedSlotA;
    setStagedSlotA(stagedSlotB);
    setStagedSlotB(temp);
  };

  const handleClearStagedA = () => setStagedSlotA(null);
  const handleClearStagedB = () => setStagedSlotB(null);
  const handleClearAllStaged = () => {
    setStagedSlotA(null);
    setStagedSlotB(null);
  };

  const handleLaunchComparison = () => {
    if (!stagedSlotA && !stagedSlotB) return;
    if (onNavigateToComparator) {
      onNavigateToComparator({
        sessionAId: stagedSlotA ? stagedSlotA.sessionId : undefined,
        lapAId: stagedSlotA ? stagedSlotA.lapId : undefined,
        sessionBId: stagedSlotB ? stagedSlotB.sessionId : undefined,
        lapBId: stagedSlotB ? stagedSlotB.lapId : undefined,
        sessionId: stagedSlotA ? stagedSlotA.sessionId : stagedSlotB?.sessionId,
        lapId: stagedSlotA ? stagedSlotA.lapId : stagedSlotB?.lapId,
        slot: stagedSlotA ? 'A' : 'B',
      });
    }
  };

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
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data: Tag[] = await res.json();
        setAvailableTags(data || []);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  const handleAddTag = async (sessionId: number, tagId?: number, newTag?: { name: string; color: string }) => {
    try {
      const payload = tagId ? { tag_id: tagId } : newTag;
      const res = await fetch(`/api/sessions/${sessionId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add tag');
      const updatedTags: Tag[] = await res.json();

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
      );
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession((prev) => (prev ? { ...prev, tags: updatedTags } : null));
      }
      if (sessionToManageTags && sessionToManageTags.id === sessionId) {
        setSessionToManageTags((prev) => (prev ? { ...prev, tags: updatedTags } : null));
      }
      fetchTags();
    } catch (err: any) {
      console.error('Error adding tag:', err);
    }
  };

  const handleRemoveTag = async (sessionId: number, tagId: number) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove tag');
      const updatedTags: Tag[] = await res.json();

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
      );
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession((prev) => (prev ? { ...prev, tags: updatedTags } : null));
      }
      if (sessionToManageTags && sessionToManageTags.id === sessionId) {
        setSessionToManageTags((prev) => (prev ? { ...prev, tags: updatedTags } : null));
      }
    } catch (err: any) {
      console.error('Error removing tag:', err);
    }
  };

  const handleDeleteGlobalTag = async (tagId: number) => {
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete tag');

      setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          tags: (s.tags || []).filter((t) => t.id !== tagId),
        }))
      );
      if (selectedSession) {
        setSelectedSession((prev) =>
          prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.id !== tagId) } : null
        );
      }
      if (sessionToManageTags) {
        setSessionToManageTags((prev) =>
          prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.id !== tagId) } : null
        );
      }
      if (selectedTagId === tagId) {
        setSelectedTagId(null);
      }
    } catch (err: any) {
      console.error('Error deleting tag:', err);
    }
  };

  const handleExportSession = async (sessionToExport: Session) => {
    try {
      const res = await fetch(`/api/sessions/${sessionToExport.id}/export`);
      if (!res.ok) throw new Error('Failed to export session');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const dateStr = sessionToExport.created_at ? new Date(sessionToExport.created_at).toISOString().split('T')[0] : 'date';
      const cleanTrack = (sessionToExport.track_name || 'track').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanType = (sessionToExport.session_type || 'session').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `${cleanTrack}_${cleanType}_${dateStr}.f1session`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error exporting session:', err);
      setToastMessage({ type: 'error', text: `${t('history.exportError') || 'Export error'}: ${err.message || err}` });
    }
  };

  const handleImportFile = async (file: File) => {
    if (!file) return;
    setImportingSession(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/sessions/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Import failed');
      }

      setToastMessage({ type: 'success', text: t('history.importSuccess') });
      await fetchSessions();
      await fetchTags();
    } catch (err: any) {
      console.error('Error importing session:', err);
      setToastMessage({ type: 'error', text: `${t('history.importError')}: ${err.message || err}` });
    } finally {
      setImportingSession(false);
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

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
    setStagedSlotA(null);
    setStagedSlotB(null);
    setActiveDetailTab('classification');

    try {
      const [partsRes, lapsRes] = await Promise.all([
        fetch(`/api/sessions/${session.id}/participants`),
        fetch(`/api/sessions/${session.id}/laps`),
      ]);

      const partsData = partsRes.ok ? await partsRes.json() : [];
      const lapsData = lapsRes.ok ? await lapsRes.json() : [];

      const normalizedLaps: Lap[] = (lapsData || []).map((l: Lap) => {
        let s3 = l.sector3_ms || 0;
        if (s3 <= 0 && l.lap_time_ms > 0 && l.sector1_ms && l.sector1_ms > 0 && l.sector2_ms && l.sector2_ms > 0) {
          const derived = l.lap_time_ms - (l.sector1_ms + l.sector2_ms);
          if (derived > 0) s3 = derived;
        }
        return { ...l, sector3_ms: s3 };
      });

      setParticipants(partsData || []);
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

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
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

  // Distinct track circuits list for filter dropdown
  const uniqueCircuits = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.track_name) set.add(s.track_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Session count per tag for filter badges
  const sessionCountByTag = useMemo(() => {
    const counts: Record<number, number> = {};
    sessions.forEach((s) => {
      (s.tags || []).forEach((t) => {
        counts[t.id] = (counts[t.id] || 0) + 1;
      });
    });
    return counts;
  }, [sessions]);

  // Session filtering and sorting logic
  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.track_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.session_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(s.id).includes(searchQuery) ||
        (s.tags && s.tags.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesType =
        sessionTypeFilter === 'ALL' ||
        s.session_type?.toLowerCase().includes(sessionTypeFilter.toLowerCase());

      const matchesCircuit =
        circuitFilter === 'ALL' ||
        s.track_name?.toLowerCase() === circuitFilter.toLowerCase();

      const matchesTag =
        selectedTagId === null ||
        (s.tags && s.tags.some((t) => t.id === selectedTagId));

      return matchesSearch && matchesType && matchesCircuit && matchesTag;
    });

    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'id') {
        comp = a.id - b.id;
      } else if (sortField === 'track') {
        comp = (a.track_name || '').localeCompare(b.track_name || '');
      } else if (sortField === 'type') {
        comp = (a.session_type || '').localeCompare(b.session_type || '');
      } else if (sortField === 'laps') {
        comp = (a.total_laps || 0) - (b.total_laps || 0);
      } else if (sortField === 'duration') {
        comp = (a.session_duration || 0) - (b.session_duration || 0);
      } else {
        // date
        comp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [sessions, searchQuery, sessionTypeFilter, circuitFilter, selectedTagId, sortField, sortOrder]);

  const isRaceSession = !!selectedSession?.session_type?.toLowerCase().includes('race');

  // Sector Records across entire session
  const { sessionBestS1, sessionBestS2, sessionBestS3 } = useMemo(() => {
    let s1 = Infinity;
    let s2 = Infinity;
    let s3 = Infinity;
    laps.forEach((l) => {
      if (l.is_valid && l.lap_time_ms > 0) {
        const lapS3 =
          l.sector3_ms !== undefined && l.sector3_ms > 0
            ? l.sector3_ms
            : l.sector1_ms && l.sector2_ms && l.sector1_ms > 0 && l.sector2_ms > 0
            ? l.lap_time_ms - (l.sector1_ms + l.sector2_ms)
            : 0;

        const isS1Valid = l.sector1_valid ?? true;
        const isS2Valid = l.sector2_valid ?? true;
        const isS3Valid = l.sector3_valid ?? true;

        if (isS1Valid && l.sector1_ms !== undefined && l.sector1_ms > 0 && l.sector1_ms < s1) s1 = l.sector1_ms;
        if (isS2Valid && l.sector2_ms !== undefined && l.sector2_ms > 0 && l.sector2_ms < s2) s2 = l.sector2_ms;
        if (isS3Valid && lapS3 > 0 && lapS3 < s3) s3 = lapS3;
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
      const cIdx = l.car_index ?? 0;
      if (!lapsByCar[cIdx]) lapsByCar[cIdx] = [];
      lapsByCar[cIdx].push(l);
    });

    const maxRaceLaps = laps.reduce((max, l) => (l.lap_time_ms > 0 && l.lap_number > max ? l.lap_number : max), 0);

    const rawStandings = (
      participants.length > 0
        ? participants
        : Object.keys(lapsByCar).map((idxStr): Participant => ({
            id: Number(idxStr),
            session_id: selectedSession.id,
            car_index: Number(idxStr),
            name: `Driver ${Number(idxStr) + 1}`,
            driver_id: 0,
            team_id: 0,
            race_number: Number(idxStr) + 1,
            ai_controlled: false,
          }))
    ).map((p: Participant) => {
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

      const officialTotalTimeMS = p.total_race_time && p.total_race_time > 0 ? Math.round(p.total_race_time * 1000) : 0;
      const officialPenaltiesSec = p.penalties_time !== undefined && p.penalties_time > 0 ? p.penalties_time : 0;
      const penaltySeconds = officialPenaltiesSec > 0 ? officialPenaltiesSec : driverLaps.reduce((maxPen, l) => Math.max(maxPen, l.penalties_seconds || 0), 0);
      const totalRaceTimeMS = officialTotalTimeMS > 0 ? officialTotalTimeMS : driverLaps.reduce((acc, l) => acc + (l.lap_time_ms > 0 ? l.lap_time_ms : 0), 0);
      const totalRaceTimeWithPenalties = totalRaceTimeMS + penaltySeconds * 1000;

      const lapWithPos = [...sortedRawLaps].reverse().find((l) => l.car_position && l.car_position > 0);
      const officialPos = p.position && p.position > 0 ? p.position : (lapWithPos ? lapWithPos.car_position! : 0);
      const gridPosition = p.grid_position && p.grid_position > 0 ? p.grid_position : 0;
      const positionsGained = gridPosition > 0 && officialPos > 0 ? gridPosition - officialPos : undefined;
      const points = p.points !== undefined && p.points > 0 ? p.points : 0;
      const resultReason = p.result_reason !== undefined ? p.result_reason : 0;
      const pitStopsCount = p.num_pit_stops !== undefined && p.num_pit_stops > 0 ? p.num_pit_stops : 0;

      const lapWithStatus = [...sortedRawLaps].reverse().find((l) => l.result_status !== undefined && l.result_status > 0);
      const resStatus = lapWithStatus ? lapWithStatus.result_status! : 0;

      const isDSQ = resStatus === 5 || resultReason === 6;
      const isDNF = resStatus === 4 || resStatus === 6 || resStatus === 7 || resultReason === 1 || resultReason === 3 || resultReason === 8 || (isRaceSession && maxRaceLaps > 5 && completedLaps.length < maxRaceLaps);

      const maxSpeed = driverLaps.reduce((max, l) => Math.max(max, l.max_speed_kmh || 0), 0);

      // Best Sectors per driver (accounting for sector validity flags)
      let bestS1MS = 0;
      let bestS2MS = 0;
      let bestS3MS = 0;

      validLaps.forEach((l) => {
        const lapS3 =
          l.sector3_ms !== undefined && l.sector3_ms > 0
            ? l.sector3_ms
            : l.sector1_ms && l.sector2_ms && l.sector1_ms > 0 && l.sector2_ms > 0
            ? l.lap_time_ms - (l.sector1_ms + l.sector2_ms)
            : 0;

        const isS1Valid = l.sector1_valid ?? true;
        const isS2Valid = l.sector2_valid ?? true;
        const isS3Valid = l.sector3_valid ?? true;

        if (isS1Valid && l.sector1_ms !== undefined && l.sector1_ms > 0 && (bestS1MS === 0 || l.sector1_ms < bestS1MS)) bestS1MS = l.sector1_ms;
        if (isS2Valid && l.sector2_ms !== undefined && l.sector2_ms > 0 && (bestS2MS === 0 || l.sector2_ms < bestS2MS)) bestS2MS = l.sector2_ms;
        if (isS3Valid && lapS3 > 0 && (bestS3MS === 0 || lapS3 < bestS3MS)) bestS3MS = lapS3;
      });

      const theoreticalBestMS = bestS1MS > 0 && bestS2MS > 0 && bestS3MS > 0 ? bestS1MS + bestS2MS + bestS3MS : 0;

      return {
        participant: p,
        laps: driverLaps,
        bestLap,
        bestLapTimeMS: bestLap ? bestLap.lap_time_ms : Infinity,
        lastLap: lastCompletedLap,
        lastLapTimeMS,
        totalRaceTimeMS,
        penaltySeconds,
        totalRaceTimeWithPenalties,
        officialPos,
        gridPosition,
        positionsGained,
        points,
        resultReason,
        pitStopsCount,
        isDNF,
        isDSQ,
        maxSpeed,
        bestS1MS,
        bestS2MS,
        bestS3MS,
        theoreticalBestMS,
      };
    });

    // Sort standings
    if (isRaceSession) {
      rawStandings.sort((a, b) => {
        if (a.isDSQ !== b.isDSQ) return a.isDSQ ? 1 : -1;
        if (a.isDNF !== b.isDNF) return a.isDNF ? 1 : -1;
        if (b.laps.length !== a.laps.length) return b.laps.length - a.laps.length;

        if (a.officialPos > 0 && b.officialPos > 0) return a.officialPos - b.officialPos;
        if (a.officialPos > 0 && b.officialPos === 0) return -1;
        if (a.officialPos === 0 && b.officialPos > 0) return 1;

        return (a.totalRaceTimeWithPenalties ?? 0) - (b.totalRaceTimeWithPenalties ?? 0);
      });
    } else {
      rawStandings.sort((a, b) => {
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

    return rawStandings.map((d, index) => ({
      ...d,
      position: index + 1,
    }));
  }, [selectedSession, participants, laps, isRaceSession]);

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
    if (!laps || laps.length === 0) return 0;
    return laps.reduce((max, l) => (l.lap_time_ms > 0 && l.lap_number > max ? l.lap_number : max), 0);
  }, [laps]);

  const totalDriversCount = Math.max(participants.length, driverStandings.length);

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
                  accept=".f1session"
                  style={{ display: 'none' }}
                  disabled={importingSession}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImportFile(e.target.files[0]);
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
              onStageLap={handleStageLap}
              onSendToComparator={onNavigateToComparator}
              formatLapTime={formatLapTime}
              formatTotalDuration={formatTotalDuration}
              renderTyreBadge={renderTyreBadge}
              renderDriverTyreStints={renderDriverTyreStints}
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
        </div>
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
            background: toastMessage.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            color: '#fff',
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
          {toastMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
