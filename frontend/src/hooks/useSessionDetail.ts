import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../utils/apiClient';
import { primeSessionLapData } from '../utils/sessionDataCache';
import { savedDriverName } from '../utils/comparatorPreferencesUtils';
import { findPlayer } from '../utils/player';
import {
  type Session,
  type Lap,
  type Participant,
  type DriverStanding,
  type ClassificationResponse,
  type ProgressionResponse,
  type StintsResponse,
  type SessionDetailResponse,
  type FeedEvent,
  type PlayerSource,
  groupLapsByCar,
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
  /** The session's race-control events in order; empty for sessions recorded before they were stored. */
  events: FeedEvent[];
  laps: Lap[];
  expandedDrivers: Record<number, boolean>;
  toggleDriverExpand: (carIndex: number) => void;
  /** Shows a session and loads its detail; History calls it when the URL names the session. */
  loadSession: (session: Session) => Promise<void>;
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  isRaceSession: boolean;
  totalSessionLaps: number;
  totalDriversCount: number;
  /** Your car in the open session (its stored car, or the saved driver name), or null. */
  playerCarIndex: number | null;
  /** How your car was found, or null when it wasn't. */
  playerSource: PlayerSource | null;
}

export function useSessionDetail({ onClearStagedSlots }: UseSessionDetailProps = {}): UseSessionDetailReturn {

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [classificationData, setClassificationData] = useState<ClassificationResponse | null>(null);
  const [progressionData, setProgressionData] = useState<ProgressionResponse | null>(null);
  const [stintsData, setStintsData] = useState<StintsResponse | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [expandedDrivers, setExpandedDrivers] = useState<Record<number, boolean>>({});

  const sessionDetailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      sessionDetailAbortRef.current?.abort();
    };
  }, []);

  const loadSession = useCallback(async (session: Session) => {
    sessionDetailAbortRef.current?.abort();
    const controller = new AbortController();
    sessionDetailAbortRef.current = controller;
    const { signal } = controller;

    setSelectedSession(session);
    setLoadingDetail(true);
    setDetailError(null);
    setExpandedDrivers({});
    onClearStagedSlots?.();

    try {
      // One request: the server loads the session's participants and laps once and sends each once.
      const detail = await api.get<SessionDetailResponse>(`/api/sessions/${session.id}/detail`, { signal });
      if (signal.aborted) return;

      // The comparator reuses these instead of loading the session again.
      primeSessionLapData(session.id, { participants: detail.participants, laps: detail.laps });
      setClassificationData(detail.classification);
      setProgressionData(detail.progression);
      setStintsData(detail.stints);
      setEvents(detail.events ?? []);
      setParticipants(detail.participants);
      // Sector 3 is already derived server side (storage.DeriveSector3).
      setLaps(detail.laps);
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        return;
      }
      setClassificationData(null);
      setProgressionData(null);
      setStintsData(null);
      setEvents([]);
      setParticipants([]);
      setLaps([]);
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

  // Driver standings for selected session (from server classification), joined with the session's
  // participants and laps by car_index.
  const driverStandings: DriverStanding[] = useMemo(() => {
    if (!selectedSession || !classificationData?.standings) return [];
    const participantsByCar = new Map(participants.map((p) => [p.car_index, p]));
    const lapsByCar = groupLapsByCar(laps);
    return classificationData.standings.map((s) =>
      normalizeDriverStanding(s, selectedSession.id, participantsByCar, lapsByCar)
    );
  }, [classificationData, selectedSession, participants, laps]);

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

  const player = useMemo(
    () => (selectedSession ? findPlayer(participants, selectedSession.player_car_index, savedDriverName()) : undefined),
    [selectedSession, participants]
  );

  return {
    selectedSession,
    setSelectedSession,
    loadingDetail,
    detailError,
    classificationData,
    progressionData,
    stintsData,
    events,
    laps,
    expandedDrivers,
    toggleDriverExpand,
    loadSession,
    driverStandings,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    isRaceSession,
    totalSessionLaps,
    totalDriversCount,
    playerCarIndex: player?.participant.car_index ?? null,
    playerSource: player?.source ?? null,
  };
}
