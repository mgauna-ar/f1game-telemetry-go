import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils/apiClient';
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

export interface UseSessionDetailProps {
  onClearStagedSlots?: () => void;
}

export interface UseSessionDetailReturn {
  selectedSession: Session | null;
  setSelectedSession: React.Dispatch<React.SetStateAction<Session | null>>;

  loadingDetail: boolean;
  detailError: string | null;
  classificationData: ClassificationResponse | null;
  progressionData: ProgressionResponse | null;
  stintsData: StintsResponse | null;
  laps: Lap[];
  expandedDrivers: Record<number, boolean>;
  toggleDriverExpand: (carIndex: number) => void;
  activeDetailTab: 'classification' | 'charts' | 'stints' | 'sectors';
  setActiveDetailTab: (tab: 'classification' | 'charts' | 'stints' | 'sectors') => void;
  selectSession: (session: Session) => Promise<void>;
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  isRaceSession: boolean;
  totalSessionLaps: number;
  totalDriversCount: number;
}

export function useSessionDetail({ onClearStagedSlots }: UseSessionDetailProps = {}): UseSessionDetailReturn {

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
  const { setSessionDebriefTarget, setContextMode } = useRaceEngineerActions();

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

      const rejectedReasons = [classRes, progRes, stintsRes, lapsRes]
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

      if (rejectedReasons.length > 0 && !classData && lapsData.length === 0) {
        setDetailError(rejectedReasons[0] || 'Error fetching session details');
      }

      setClassificationData(classData);
      setProgressionData(progData);
      setStintsData(stintsDataRes);
      // Sector 3 is already derived server side (storage.DeriveSector3).
      setLaps(lapsData);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Error fetching session details';
      setDetailError(msg);
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

  // Point the AI debrief at this session once its classification has loaded; the server
  // builds the debrief from the session ID.
  const hasStandings = driverStandings.length > 0;
  const debriefSessionId = selectedSession?.id;
  const debriefTrackName = selectedSession?.track_name ?? '';
  useEffect(() => {
    if (debriefSessionId !== undefined && hasStandings) {
      setSessionDebriefTarget({ sessionId: debriefSessionId, trackName: debriefTrackName });
      setContextMode('session_debrief');
    } else {
      setSessionDebriefTarget(null);
      setContextMode('general');
    }
  }, [debriefSessionId, debriefTrackName, hasStandings, setSessionDebriefTarget, setContextMode]);

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
