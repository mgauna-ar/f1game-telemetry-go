import type { Participant, Lap } from '../types/session';
import type { ComparatorRivalMode } from '../types/comparatorPreferences';
import { sortLapsByQuality } from './lapUtils';
import { findParticipantByPartialName } from './player';

export { findParticipantByPartialName };

export interface LapResolutionResult {
  lapId: number | '';
  driver?: Participant;
}

/**
 * The reference slot's default lap: your best lap (your car in that session, recorded or picked),
 * otherwise the session's fastest.
 */
export function resolveReferenceLap(
  participants: Participant[],
  laps: Lap[],
  playerCarIndex: number | null = null
): LapResolutionResult {
  if (laps.length === 0) {
    return { lapId: '' };
  }

  const matched = participants.find((p) => p.car_index === playerCarIndex);
  if (matched) {
    const driverLaps = sortLapsByQuality(laps.filter((l) => (l.car_index ?? -1) === matched.car_index));
    if (driverLaps.length > 0) {
      return { lapId: driverLaps[0].id, driver: matched };
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
  referencePlayerCarIndex: number | null = null
): LapResolutionResult {
  const preferredReference = () => participants.find((p) => p.car_index === referencePlayerCarIndex);
  const hasPreferredReference = referencePlayerCarIndex !== null;
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
        if (hasPreferredReference) {
          const prefDriver = preferredReference();
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
    const effectiveRefDriver = referenceDriver || (hasPreferredReference ? preferredReference() : undefined);

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
