import { RESULT_STATUS, DRIVER_STATUS } from '../constants/f1';
import type { ParticipantData, LapData } from '../types/telemetry';
import type { Participant, Lap } from '../types/session';

export interface LiveDriverFilterParams {
  participant: ParticipantData;
  carIndex: number;
  playerCarIndex?: number;
  lap?: LapData;
}

/**
 * Determines whether a participant is active in a live telemetry session.
 * - Always includes the local player and any human drivers.
 * - For AI drivers, only includes them if they have active on-track status, lap times, positions, or telemetry.
 */
export function isLiveDriverActive(params: LiveDriverFilterParams): boolean {
  const { participant, carIndex, playerCarIndex, lap } = params;

  // Local player is always active
  if (playerCarIndex !== undefined && carIndex === playerCarIndex) {
    return true;
  }

  // Human drivers in the multiplayer lobby are always active
  const isHuman =
    participant.AIControlled === 0 &&
    Boolean(participant.Name && typeof participant.Name === 'string' && participant.Name.trim() !== '');
  if (isHuman) {
    return true;
  }

  // If AI driver, check for actual session/track activity
  if (!lap) return false;

  const resStatus =
    lap.ResultStatus !== undefined
      ? lap.ResultStatus
      : (lap.CarPosition ?? 0) > 0
      ? RESULT_STATUS.ACTIVE
      : RESULT_STATUS.INVALID;

  const hasValidStatus =
    resStatus === RESULT_STATUS.ACTIVE ||
    resStatus === RESULT_STATUS.FINISHED ||
    resStatus === RESULT_STATUS.DNF ||
    resStatus === RESULT_STATUS.DSQ;

  const hasTimes = (lap.LastLapTimeInMS ?? 0) > 0 || (lap.CurrentLapTimeInMS ?? 0) > 0;
  const hasPosition = (lap.CarPosition ?? 0) > 0;
  const hasLeftGarage = (lap.DriverStatus ?? DRIVER_STATUS.IN_GARAGE) !== DRIVER_STATUS.IN_GARAGE;
  const hasDistance = (lap.LapDistance ?? 0) > 0 && (lap.CurrentLapNum ?? 0) >= 1;

  return hasValidStatus && (hasTimes || hasPosition || hasLeftGarage || hasDistance);
}

/**
 * Filters an array of live participants and returns only the active drivers along with their original car index.
 */
export function filterActiveLiveParticipants(
  participants: ParticipantData[],
  laps: LapData[],
  playerCarIndex: number = 0
): { participant: ParticipantData; carIndex: number }[] {
  return participants
    .map((p, idx) => ({ participant: p, carIndex: idx }))
    .filter(({ participant, carIndex }) =>
      isLiveDriverActive({
        participant,
        carIndex,
        playerCarIndex,
        lap: laps[carIndex],
      })
    );
}

export interface HistoricalDriverFilterParams {
  participant: Participant;
  driverLaps?: Lap[];
  isRaceSession?: boolean;
}

/**
 * Determines whether a participant is active in a historical/saved session.
 * - Always includes human players.
 * - For AI drivers, only includes them if they completed laps, set sector times, have telemetry, or have official race classifications.
 */
export function isHistoricalDriverActive(params: HistoricalDriverFilterParams): boolean {
  const { participant, driverLaps = [], isRaceSession = false } = params;

  const isHuman = !participant.ai_controlled && Boolean(participant.name && participant.name.trim() !== '');
  if (isHuman) return true;

  const hasCompletedLaps = driverLaps.some((l) => l.lap_time_ms > 0);
  const hasSectors = driverLaps.some(
    (l) => (l.sector1_ms ?? 0) > 0 || (l.sector2_ms ?? 0) > 0 || (l.sector3_ms ?? 0) > 0
  );
  const hasTelemetry = driverLaps.some((l) => l.has_telemetry && (l.sample_count ?? 0) > 10);
  const hasOfficialResult =
    (participant.total_race_time ?? 0) > 0 ||
    (participant.points ?? 0) > 0 ||
    (isRaceSession && (participant.position ?? 0) > 0);

  return hasCompletedLaps || hasSectors || hasTelemetry || hasOfficialResult;
}

/**
 * Filters an array of historical participants and returns only those who actually participated in the session.
 */
export function filterActiveHistoricalParticipants(
  participants: Participant[],
  laps: Lap[],
  isRaceSession: boolean = false
): Participant[] {
  const lapsByCar: Record<number, Lap[]> = {};
  for (const lap of laps) {
    const cIdx = lap.car_index ?? 0;
    if (!lapsByCar[cIdx]) lapsByCar[cIdx] = [];
    lapsByCar[cIdx].push(lap);
  }

  return participants.filter((p) =>
    isHistoricalDriverActive({
      participant: p,
      driverLaps: lapsByCar[p.car_index] || [],
      isRaceSession,
    })
  );
}
