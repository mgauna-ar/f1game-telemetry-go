import type { DriverStanding as RawDriverStanding, StintExcludedLap } from './generated/analytics';
import type {
  ImportBatchResponse as GeneratedImportBatchResponse,
  ImportDetail as GeneratedImportDetail,
} from './generated/session';
import type { Lap, Participant } from './generated/storage';
import type { Narrows } from './wire';

// Wire types generated from the Go structs (go run ./cmd/tsgen). The camelCase client models
// below (DriverStanding, DriverStint) are built from them.
export type { BatchPlayerResult, Lap, Participant, PlayerCarSource, Session, Tag } from './generated/storage';
export type { BatchPlayerRequest, SetPlayerCarRequest } from './generated/api';
export type { WeatherForecastSample } from './generated/packets';
export type { FeedEvent } from './generated/session';
export type {
  ClassificationResponse,
  CompoundBestLap,
  DegradationRow,
  DriverStanding as RawDriverStanding,
  DriverStint as RawDriverStint,
  DriverStintData,
  ProgressionDriverMeta,
  PlayerResult,
  PlayerSource,
  ProgressionResponse,
  ProgressionRow,
  SessionDetailResponse,
  SessionListItem,
  SessionSummary,
  SpeedRanking,
  StintInfo as StandingStint,
  StintExcludedLap,
  StintKPIs,
  StintLongestSummary,
  StintsResponse,
  SummaryDriver,
  SummaryLap,
} from './generated/analytics';

/** A participant for a car the server sent no participant row for, with the given fields set. */
export function placeholderParticipant(fields: Partial<Participant>): Participant {
  return {
    id: 0,
    session_id: 0,
    car_index: 0,
    name: '',
    driver_id: 0,
    team_id: 0,
    race_number: 0,
    ai_controlled: false,
    nationality: 0,
    grid_position: 0,
    position: 0,
    points: 0,
    total_race_time: 0,
    penalties_time: 0,
    num_penalties: 0,
    result_reason: 0,
    num_pit_stops: 0,
    result_status: 0,
    created_at: '',
    ...fields,
  };
}

export interface StagedLap {
  sessionId: number;
  sessionName?: string;
  lapId: number;
  lapNumber: number;
  lapTimeMS: number;
  driverName: string;
  teamId: number;
  raceNumber?: number;
  tyreCompound?: string;
  isValid?: boolean;
}

export interface DriverStanding {
  position: number;
  carIndex: number;
  driverName: string;
  teamName: string;
  teamId: number;
  raceNumber: number;
  gridPosition?: number;
  positionsGained?: number;
  bestLapTimeMS: number;
  bestLapNumber?: number;
  bestLapId?: number;
  bestLapS1MS?: number;
  bestLapS2MS?: number;
  bestLapS3MS?: number;
  lastLapTimeMS?: number;
  totalRaceTimeMS?: number;
  totalWithPenaltiesMS?: number;
  totalRaceTimeWithPenalties?: number;
  penaltySeconds?: number;
  points?: number;
  isDNF: boolean;
  isDSQ: boolean;
  resultReason?: number;
  maxSpeed: number;
  bestS1MS: number;
  bestS2MS: number;
  bestS3MS: number;
  theoreticalBestMS?: number;
  gapToLeaderMS?: number;
  intervalMS?: number;
  lapsCompleted?: number;
  pitStopsCount?: number;
  stintsSummary?: string;
  aiControlled?: boolean;
  bestLap?: Lap | null;
  participant: Participant;
  laps: Lap[];
}

/**
 * Builds a client standing from a classification row, joining the session's participants and laps
 * by car_index (the server sends them once, next to the classification).
 */
export function normalizeDriverStanding(
  raw: RawDriverStanding,
  sessionId: number,
  participantsByCar: ReadonlyMap<number, Participant>,
  lapsByCar: ReadonlyMap<number, Lap[]>
): DriverStanding {
  const joined = participantsByCar.get(raw.car_index);
  const p: Participant = joined
    ? { ...joined, position: raw.position }
    : placeholderParticipant({
      id: raw.car_index ?? 0,
      session_id: sessionId,
      car_index: raw.car_index ?? 0,
      name: raw.driver_name ?? '',
      team_id: raw.team_id ?? 0,
      race_number: raw.race_number ?? 0,
      ai_controlled: raw.ai_controlled ?? false,
      position: raw.position ?? 0,
      grid_position: raw.grid_position,
      points: raw.points,
      result_reason: raw.result_reason,
    });
  const totalWithPenalties = raw.total_with_penalties_ms ?? 0;
  const laps = lapsByCar.get(raw.car_index) ?? [];
  return {
    position: raw.position ?? 0,
    carIndex: raw.car_index ?? p.car_index,
    driverName: raw.driver_name ?? p.name,
    teamName: raw.team_name ?? '',
    teamId: raw.team_id ?? p.team_id,
    raceNumber: raw.race_number ?? p.race_number,
    gridPosition: raw.grid_position ?? p.grid_position,
    positionsGained: raw.positions_gained,
    bestLapTimeMS: raw.best_lap_time_ms ?? 0,
    bestLapNumber: raw.best_lap_number,
    bestLapId: raw.best_lap_id,
    bestLapS1MS: raw.best_lap_s1_ms,
    bestLapS2MS: raw.best_lap_s2_ms,
    bestLapS3MS: raw.best_lap_s3_ms,
    lastLapTimeMS: raw.last_lap_time_ms ?? 0,
    totalRaceTimeMS: raw.total_race_time_ms ?? 0,
    totalWithPenaltiesMS: totalWithPenalties,
    totalRaceTimeWithPenalties: totalWithPenalties,
    penaltySeconds: raw.penalty_seconds ?? 0,
    points: raw.points,
    isDNF: raw.is_dnf ?? false,
    isDSQ: raw.is_dsq ?? false,
    resultReason: raw.result_reason,
    maxSpeed: raw.max_speed ?? 0,
    bestS1MS: raw.best_s1_ms ?? 0,
    bestS2MS: raw.best_s2_ms ?? 0,
    bestS3MS: raw.best_s3_ms ?? 0,
    theoreticalBestMS: raw.theoretical_best_ms ?? 0,
    gapToLeaderMS: raw.gap_to_leader_ms,
    intervalMS: raw.interval_ms,
    lapsCompleted: raw.laps_completed,
    pitStopsCount: raw.pit_stops_count,
    stintsSummary: raw.stints_summary,
    aiControlled: raw.ai_controlled ?? p.ai_controlled,
    bestLap: (raw.best_lap_id && laps.find((l) => l.id === raw.best_lap_id)) || null,
    participant: p,
    laps,
  };
}

/** Groups laps by car_index, keeping their order. */
export function groupLapsByCar(laps: readonly Lap[]): Map<number, Lap[]> {
  const byCar = new Map<number, Lap[]>();
  for (const lap of laps) {
    const carLaps = byCar.get(lap.car_index);
    if (carLaps) carLaps.push(lap);
    else byCar.set(lap.car_index, [lap]);
  }
  return byCar;
}

export interface DriverStint {
  stintIndex: number;
  stintId: number;
  compound: string;
  actualCompound?: string;
  startLap: number;
  endLap: number;
  totalLaps: number;
  avgLapTimeMS: number;
  bestLapTimeMS: number;
  hasPitStopAfter: boolean;
  degSlopeSecPerLap?: number | null;
  /** How many laps the slope and the average are taken from. */
  fitLaps: number;
  /** Timed laps left out of the fit, and why. */
  excludedLaps: StintExcludedLap[];
}

/** Outcome for one file of POST /api/sessions/import. */
export type ImportDetail = Narrows<
  Omit<GeneratedImportDetail, 'status'> & { status: 'imported' | 'skipped' | 'failed' },
  GeneratedImportDetail
>;

/**
 * Body of POST /api/sessions/import. When nothing was imported or skipped the server answers 400
 * with this body, and `error` holds the first failure reason.
 */
export type ImportBatchResponse = Narrows<
  Omit<GeneratedImportBatchResponse, 'status' | 'details'> & {
    status: 'success' | 'partial_failure' | 'error';
    details: ImportDetail[];
  },
  GeneratedImportBatchResponse
>;
