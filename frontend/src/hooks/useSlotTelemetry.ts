import { useState, useEffect, useMemo, useRef } from 'react';
import type { Participant, Lap } from '../types/session';
import type { ComparatorRivalMode } from '../types/comparatorPreferences';
import { filterActiveHistoricalParticipants } from '../utils/driverFilter';
import { sortLapsByQuality } from '../utils/lapUtils';
import { getSessionLapData } from '../utils/sessionDataCache';
import { resolveReferenceLap, resolveComparisonLap } from '../utils/comparatorPreferencesUtils';

export interface UseSlotTelemetryOptions {
  sessionId: number | '';
  preloadLapId?: number;
  isSlotB?: boolean;
  isSameSessionAsSlotA?: boolean;
  defaultDriverName?: string;
  /** Your car in this slot's session (recorded or picked); null when it has none. */
  playerCarIndex?: number | null;
  referenceDriver?: Participant;
  referenceLapId?: number | '';
  rivalMode?: ComparatorRivalMode;
  rivalDriverName?: string;
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
  /** The session whose laps have finished loading (or failed to), so its lap choice is final. */
  loadedSessionId: number | '';
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
  playerCarIndex = null,
  referenceDriver,
  referenceLapId,
  rivalMode = 'fastest',
  rivalDriverName = '',
}: UseSlotTelemetryOptions): UseSlotTelemetryReturn {
  const [laps, setLaps] = useState<Lap[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lapId, setLapId] = useState<number | ''>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<number | ''>('');

  // Keep references to options that can be read inside the async fetch handler
  const optionsRef = useRef({
    preloadLapId,
    isSlotB,
    isSameSessionAsSlotA,
    playerCarIndex,
    referenceDriver,
    referenceLapId,
    rivalMode,
    rivalDriverName,
  });

  useEffect(() => {
    optionsRef.current = {
      preloadLapId,
      isSlotB,
      isSameSessionAsSlotA,
        playerCarIndex,
      referenceDriver,
      referenceLapId,
      rivalMode,
      rivalDriverName,
    };
  }, [
    preloadLapId,
    isSlotB,
    isSameSessionAsSlotA,
    playerCarIndex,
    referenceDriver,
    referenceLapId,
    rivalMode,
    rivalDriverName,
  ]);

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

    // The load is shared with the other slot and Session History (sessionDataCache), so it isn't
    // aborted here; a result that arrives after the session changed is ignored.
    let cancelled = false;

    setLoading(true);
    setError(null);

    getSessionLapData(sessionId)
      .then(({ participants: parts, laps: list }) => {
        if (cancelled) return;
        setParticipants(parts);
        setLaps(list);

        const currentOpts = optionsRef.current;
        if (currentOpts.preloadLapId && list.some((l) => l.id === currentOpts.preloadLapId)) {
          setLapId(currentOpts.preloadLapId);
        } else if (list.length > 0) {
          if (!currentOpts.isSlotB) {
            const refRes = resolveReferenceLap(parts, list, currentOpts.playerCarIndex);
            setLapId(refRes.lapId);
          } else {
            const compRes = resolveComparisonLap(
              parts,
              list,
              currentOpts.referenceDriver,
              currentOpts.rivalMode,
              currentOpts.rivalDriverName,
              currentOpts.referenceLapId,
              currentOpts.isSameSessionAsSlotA,
              currentOpts.playerCarIndex
            );
            setLapId(compRes.lapId);
          }
        } else {
          setLapId('');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading session data');
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadedSessionId(sessionId);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
    loadedSessionId,
    selectedLap,
    driver,
    driverName,
    activeParticipants,
  };
}
