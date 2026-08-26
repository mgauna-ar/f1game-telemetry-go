import { useState, useEffect, useMemo } from 'react';
import type { Participant, Lap } from '../types/session';
import { filterActiveHistoricalParticipants } from '../utils/driverFilter';

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

  // Load participants & laps when sessionId changes
  useEffect(() => {
    if (sessionId !== '') {
      setLoading(true);
      Promise.all([
        fetch(`/api/sessions/${sessionId}/participants`)
          .then((res) => res.json())
          .then((data) => setParticipants(data || []))
          .catch((err) => console.error('Failed to fetch participants', err)),
        fetch(`/api/sessions/${sessionId}/laps`)
          .then((res) => res.json())
          .then((data) => {
            const list: Lap[] = data || [];
            setLaps(list);

            if (preloadLapId && list.some((l) => l.id === preloadLapId)) {
              setLapId(preloadLapId);
            } else if (list.length > 0) {
              const valid = list
                .filter((l) => l.lap_time_ms > 0 && (l.is_valid || (l.sector1_ms ?? 0) > 0))
                .sort((a, b) => {
                  const aValid = a.is_valid ? 1 : 0;
                  const bValid = b.is_valid ? 1 : 0;
                  if (aValid !== bValid) return bValid - aValid;
                  if (a.lap_time_ms !== b.lap_time_ms) return a.lap_time_ms - b.lap_time_ms;
                  const scoreA = (a.has_telemetry ? 10 : 0) + ((a.sector1_ms ?? 0) > 0 ? 5 : 0);
                  const scoreB = (b.has_telemetry ? 10 : 0) + ((b.sector1_ms ?? 0) > 0 ? 5 : 0);
                  return scoreB - scoreA;
                });

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
          .catch((err) => console.error('Failed to fetch laps', err)),
      ]).finally(() => setLoading(false));
    } else {
      setParticipants([]);
      setLaps([]);
      setLapId('');
      setLoading(false);
    }
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
      const driverLaps = laps
        .filter((l) => (l.car_index ?? -1) === p.car_index && l.lap_time_ms > 0 && (l.is_valid || (l.sector1_ms ?? 0) > 0))
        .sort((a, b) => {
          const aValid = a.is_valid ? 1 : 0;
          const bValid = b.is_valid ? 1 : 0;
          if (aValid !== bValid) return bValid - aValid;
          if (a.lap_time_ms !== b.lap_time_ms) return a.lap_time_ms - b.lap_time_ms;
          const scoreA = (a.has_telemetry ? 10 : 0) + ((a.sector1_ms ?? 0) > 0 ? 5 : 0);
          const scoreB = (b.has_telemetry ? 10 : 0) + ((b.sector1_ms ?? 0) > 0 ? 5 : 0);
          return scoreB - scoreA;
        });
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
    selectedLap,
    driver,
    driverName,
    activeParticipants,
  };
}
