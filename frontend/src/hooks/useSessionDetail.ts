import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils/apiClient';
import { formatLapTime } from '../utils/formatters';
import { useRaceEngineerActions } from '../context/RaceEngineerContext';
import {
  type Session,
  type Lap,
  type DriverStanding,
  type ClassificationResponse,
  type ProgressionResponse,
  type StintsResponse,
  normalizeDriverStanding,
} from '../types/session';

interface UseSessionDetailProps {
  onClearStagedSlots?: () => void;
}

export function useSessionDetail({ onClearStagedSlots }: UseSessionDetailProps = {}) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [classificationData, setClassificationData] = useState<ClassificationResponse | null>(null);
  const [progressionData, setProgressionData] = useState<ProgressionResponse | null>(null);
  const [stintsData, setStintsData] = useState<StintsResponse | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});
  const [activeDetailTab, setActiveDetailTab] = useState<'classification' | 'charts' | 'stints' | 'sectors'>('classification');

  const sessionDetailAbortRef = useRef<AbortController | null>(null);

  // AI Race Engineer Context Hook
  const { setSessionDebriefContext, setContextMode } = useRaceEngineerActions();

  useEffect(() => {
    return () => {
      sessionDetailAbortRef.current?.abort();
    };
  }, []);

  const selectSession = useCallback(async (session: Session) => {
    sessionDetailAbortRef.current?.abort();
    const controller = new AbortController();
    sessionDetailAbortRef.current = controller;
    const { signal } = controller;

    setSelectedSession(session);
    setLoadingDetail(true);
    setDetailError(null);
    setExpandedDrivers({});
    onClearStagedSlots?.();
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
  }, [onClearStagedSlots]);

  const toggleDriverExpand = useCallback((carIndex: number) => {
    setExpandedDrivers((prev) => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
  }, []);

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

  return {
    selectedSession,
    setSelectedSession,
    loadingDetail,
    detailError,
    classificationData,
    progressionData,
    stintsData,
    laps,
    expandedDrivers,
    toggleDriverExpand,
    activeDetailTab,
    setActiveDetailTab,
    selectSession,
    driverStandings,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    isRaceSession,
    totalSessionLaps,
    totalDriversCount,
  };
}
