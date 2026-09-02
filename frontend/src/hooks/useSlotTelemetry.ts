import { useState, useEffect, useMemo } from 'react';
import type { Participant, Lap } from '../types/session';
import { filterActiveHistoricalParticipants } from '../utils/driverFilter';
import { sortLapsByQuality } from '../utils/lapUtils';
import { api } from '../utils/apiClient';

export interface UseSlotTelemetryOptions {
  sessionId: number | '';
  preloadLapId?: number;
  isSlotB?: boolean;
  isSameSessionAsSlotA?: boolean;
  defaultDriverName?: string;
}

export interface ActiveParticipantWithBestLap extends Participant {
  bestLap: Lap | null;
}

export interface UseSlotTelemetryReturn {
  laps: Lap[];
  setLaps: React.Dispatch<React.SetStateAction<Lap[]>>;
  participants: Participant[];
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  lapId: number | '';
  setLapId: React.Dispatch<React.SetStateAction<number | ''>>;
  loading: boolean;
  error: string | null;
  selectedLap: Lap | undefined;
  driver: Participant | undefined;
  driverName: string;
  activeParticipants: ActiveParticipantWithBestLap[];
}

export function useSlotTelemetry({
  sessionId,
  preloadLapId,
  isSlotB = false,
  isSameSessionAsSlotA = false,
  defaultDriverName = 'Lap',
}: UseSlotTelemetryOptions): UseSlotTelemetryReturn {
  const [laps, setLaps] = useState<Lap[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lapId, setLapId] = useState<number | ''>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load participants & laps when sessionId changes
  useEffect(() => {
    if (sessionId === '') {
      setParticipants([]);
      setLaps([]);
      setLapId('');
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Participant[]>(`/api/sessions/${sessionId}/participants`, { signal })
        .then((data) => {
          if (!signal.aborted) setParticipants(data || []);
        })
        .catch((err) => {
          if (!signal.aborted && err.name !== 'AbortError') {
            setError(err instanceof Error ? err.message : 'Error loading participants');
          }
        }),
      api.get<Lap[]>(`/api/sessions/${sessionId}/laps`, { signal })
        .then((data) => {
          if (signal.aborted) return;
          const list: Lap[] = data || [];
          setLaps(list);

          if (preloadLapId && list.some((l) => l.id === preloadLapId)) {
            setLapId(preloadLapId);
          } else if (list.length > 0) {
            const valid = sortLapsByQuality(list);
            if (isSlotB && isSameSessionAsSlotA && valid.length > 1) {
              setLapId(valid[1].id);
            } else if (valid.length > 0) {
              setLapId(valid[0].id);
            } else {
              setLapId(list[0].id);
            }
          } else {
            setLapId('');
          }
        })
        .catch((err) => {
          if (!signal.aborted && err.name !== 'AbortError') {
            setError(err instanceof Error ? err.message : 'Error loading laps');
          }
        }),
    ]).finally(() => {
      if (!signal.aborted) setLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [sessionId, preloadLapId, isSlotB, isSameSessionAsSlotA]);

  // Selected lap object
  const selectedLap = useMemo(() => laps.find((l) => l.id === lapId), [laps, lapId]);

  // Driver details for current lap
  const driver = useMemo(
    () => (selectedLap?.car_index !== undefined ? participants.find((p) => p.car_index === selectedLap.car_index) : undefined),
    [selectedLap, participants]
  );

  const driverName = useMemo(
    () => (driver ? `#${driver.race_number} ${driver.name}` : defaultDriverName),
    [driver, defaultDriverName]
  );

  // Active participants with their best laps
  const activeParticipants = useMemo(() => {
    if (participants.length === 0 || laps.length === 0) return [];
    return filterActiveHistoricalParticipants(participants, laps).map((p) => {
      const driverLaps = sortLapsByQuality(laps.filter((l) => (l.car_index ?? -1) === p.car_index));
      const bestLap = driverLaps.length > 0 ? driverLaps[0] : null;
      return { ...p, bestLap };
    });
  }, [participants, laps]);

  return {
    laps,
    setLaps,
    participants,
    setParticipants,
    lapId,
    setLapId,
    loading,
    error,
    selectedLap,
    driver,
    driverName,
    activeParticipants,
  };
}
