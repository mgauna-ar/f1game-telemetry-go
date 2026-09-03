import type { Participant, Lap } from '../types/session';
import type { ComparatorPreferences, ComparatorRivalMode } from '../types/comparatorPreferences';
import { storage } from './storage';
import { sortLapsByQuality } from './lapUtils';

export const DEFAULT_COMPARATOR_PREFERENCES: ComparatorPreferences = {
  defaultDriverName: '',
  rivalMode: 'fastest',
  rivalDriverName: '',
};

export function loadComparatorPreferences(): ComparatorPreferences {
  const defaultDriverName = storage.get<string>('f1_comparator_default_driver_name', '');
  const rivalMode = storage.get<ComparatorRivalMode>('f1_comparator_rival_mode', 'fastest');
  const rivalDriverName = storage.get<string>('f1_comparator_rival_driver_name', '');

  return {
    defaultDriverName: typeof defaultDriverName === 'string' ? defaultDriverName : '',
    rivalMode: rivalMode === 'teammate' || rivalMode === 'driver' ? rivalMode : 'fastest',
    rivalDriverName: typeof rivalDriverName === 'string' ? rivalDriverName : '',
  };
}

export function saveComparatorPreferences(prefs: ComparatorPreferences): void {
  storage.set('f1_comparator_default_driver_name', prefs.defaultDriverName.trim());
  storage.set('f1_comparator_rival_mode', prefs.rivalMode);
  storage.set('f1_comparator_rival_driver_name', prefs.rivalDriverName.trim());
}

export function findParticipantByPartialName(
  participants: Participant[],
  query: string
): Participant | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  return participants.find((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.race_number.toString() === q || `#${p.race_number}` === q) return true;
    return false;
  });
}

export interface LapResolutionResult {
  lapId: number | '';
  driver?: Participant;
}

export function resolveReferenceLap(
  participants: Participant[],
  laps: Lap[],
  defaultDriverName: string
): LapResolutionResult {
  if (laps.length === 0) {
    return { lapId: '' };
  }

  const query = defaultDriverName.trim();
  if (query) {
    const matched = findParticipantByPartialName(participants, query);
    if (matched) {
      const driverLaps = sortLapsByQuality(
        laps.filter((l) => (l.car_index ?? -1) === matched.car_index)
      );
      if (driverLaps.length > 0) {
        return { lapId: driverLaps[0].id, driver: matched };
      }
    }
  }

  // Fallback to fastest lap across session
  const sorted = sortLapsByQuality(laps);
  const bestLap = sorted.length > 0 ? sorted[0] : laps[0];
  const driver = participants.find((p) => p.car_index === bestLap.car_index);
  return { lapId: bestLap.id, driver };
}

export function resolveComparisonLap(
  participants: Participant[],
  laps: Lap[],
  referenceDriver: Participant | undefined,
  rivalMode: ComparatorRivalMode,
  rivalDriverName: string,
  referenceLapId?: number | '',
  isSameSessionAsReference?: boolean,
  preferredReferenceDriverName?: string
): LapResolutionResult {
  if (laps.length === 0) {
    return { lapId: '' };
  }

  const sorted = sortLapsByQuality(laps);

  // Helper for fastest fallback, with P1 tiebreaker (chooses P2 if Reference is P1)
  const getFastestFallback = (): LapResolutionResult => {
    if (sorted.length > 1) {
      if (referenceLapId && sorted[0].id === referenceLapId) {
        const p2Lap = sorted[1];
        const p2Driver = participants.find((p) => p.car_index === p2Lap.car_index);
        return { lapId: p2Lap.id, driver: p2Driver };
      }
      if (!referenceLapId && isSameSessionAsReference) {
        if (preferredReferenceDriverName?.trim()) {
          const prefDriver = findParticipantByPartialName(participants, preferredReferenceDriverName);
          if (prefDriver) {
            const prefLaps = sortLapsByQuality(
              laps.filter((l) => (l.car_index ?? -1) === prefDriver.car_index)
            );
            if (prefLaps.length > 0 && prefLaps[0].id === sorted[0].id) {
              const p2Lap = sorted[1];
              const p2Driver = participants.find((p) => p.car_index === p2Lap.car_index);
              return { lapId: p2Lap.id, driver: p2Driver };
            }
          }
        } else {
          const p2Lap = sorted[1];
          const p2Driver = participants.find((p) => p.car_index === p2Lap.car_index);
          return { lapId: p2Lap.id, driver: p2Driver };
        }
      }
    }

    const bestLap = sorted.length > 0 ? sorted[0] : laps[0];
    const bestDriver = participants.find((p) => p.car_index === bestLap.car_index);
    return { lapId: bestLap.id, driver: bestDriver };
  };

  // 1. Teammate mode
  if (rivalMode === 'teammate') {
    const effectiveRefDriver =
      referenceDriver ||
      (preferredReferenceDriverName
        ? findParticipantByPartialName(participants, preferredReferenceDriverName)
        : undefined);

    if (effectiveRefDriver) {
      const teammate = participants.find(
        (p) => p.team_id === effectiveRefDriver.team_id && p.car_index !== effectiveRefDriver.car_index
      );
      if (teammate) {
        const teammateLaps = sortLapsByQuality(
          laps.filter((l) => (l.car_index ?? -1) === teammate.car_index)
        );
        if (teammateLaps.length > 0) {
          return { lapId: teammateLaps[0].id, driver: teammate };
        }
      }
    }
    return getFastestFallback();
  }

  // 2. Specific driver mode
  if (rivalMode === 'driver' && rivalDriverName.trim()) {
    const rival = findParticipantByPartialName(participants, rivalDriverName);
    if (rival) {
      const rivalLaps = sortLapsByQuality(
        laps.filter((l) => (l.car_index ?? -1) === rival.car_index)
      );
      if (rivalLaps.length > 0) {
        return { lapId: rivalLaps[0].id, driver: rival };
      }
    }
    return getFastestFallback();
  }

  // 3. Default: Fastest lap mode
  return getFastestFallback();
}
