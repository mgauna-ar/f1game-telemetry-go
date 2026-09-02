import type { WeatherForecastSample } from './telemetry';
export type { WeatherForecastSample };

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at?: string;
}

export interface Session {
  id: number;
  session_uid: string | number;
  track_id?: number;
  track_name: string;
  session_type: string;
  weather?: string;
  weather_forecast?: string | WeatherForecastSample[];
  total_laps?: number;
  ai_difficulty?: number;
  session_duration?: number;
  packet_format?: number;
  created_at: string;
  tags?: Tag[];
}

export interface Participant {
  id: number;
  session_id: number;
  car_index: number;
  name: string;
  driver_id: number;
  team_id: number;
  race_number: number;
  ai_controlled: boolean;
  nationality?: number;
  grid_position?: number;
  position?: number;
  points?: number;
  total_race_time?: number;
  penalties_time?: number;
  num_penalties?: number;
  result_reason?: number;
  num_pit_stops?: number;
  result_status?: number;
}

export interface Lap {
  id: number;
  session_id: number;
  car_index?: number;
  lap_number: number;
  lap_time_ms: number;
  sector1_ms?: number;
  sector2_ms?: number;
  sector3_ms?: number;
  is_valid: boolean;
  tyre_compound?: string;
  actual_compound?: string;
  sector1_valid?: boolean;
  sector2_valid?: boolean;
  sector3_valid?: boolean;
  fuel_load?: number;
  max_speed_kmh?: number;
  penalties_seconds?: number;
  car_position?: number;
  result_status?: number;
  stint?: number;
  created_at?: string;
  has_telemetry?: boolean;
  sample_count?: number;
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

export interface SpeedRanking {
  car_index: number;
  driver_name: string;
  team_id: number;
  max_speed: number;
  delta_to_top: number;
}

export interface RawDriverStanding {
  position: number;
  car_index?: number;
  driver_name?: string;
  team_name?: string;
  team_id?: number;
  race_number?: number;
  grid_position?: number;
  positions_gained?: number;
  best_lap_time_ms?: number;
  best_lap_number?: number;
  best_lap_id?: number;
  best_lap_s1_ms?: number;
  best_lap_s2_ms?: number;
  best_lap_s3_ms?: number;
  last_lap_time_ms?: number;
  total_race_time_ms?: number;
  total_with_penalties_ms?: number;
  penalty_seconds?: number;
  laps_completed?: number;
  stints_summary?: string;
  ai_controlled?: boolean;
  result_reason?: number;
  best_lap?: Lap | null;
  last_lap?: Lap | null;
  is_dnf?: boolean;
  is_dsq?: boolean;
  max_speed?: number;
  best_s1_ms?: number;
  best_s2_ms?: number;
  best_s3_ms?: number;
  theoretical_best_ms?: number;
  gap_to_leader_ms?: number;
  interval_ms?: number;
  pit_stops_count?: number;
  participant?: Participant;
  laps?: Lap[];
  points?: number;
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
  lastLap?: Lap | null;
  participant: Participant;
  laps: Lap[];
}

export function normalizeDriverStanding(s: RawDriverStanding | DriverStanding, sessionId: number): DriverStanding {
  const raw = s as RawDriverStanding & Partial<DriverStanding>;
  const p: Participant = raw.participant || {
    id: raw.car_index ?? raw.carIndex ?? 0,
    session_id: sessionId,
    car_index: raw.car_index ?? raw.carIndex ?? 0,
    name: raw.driver_name ?? raw.driverName ?? '',
    driver_id: 0,
    team_id: raw.team_id ?? raw.teamId ?? 0,
    race_number: raw.race_number ?? raw.raceNumber ?? 0,
    ai_controlled: raw.ai_controlled ?? raw.aiControlled ?? false,
    position: raw.position ?? 0,
    grid_position: raw.grid_position ?? raw.gridPosition,
    points: raw.points,
    result_reason: raw.result_reason ?? raw.resultReason,
    result_status: 0,
  };
  const totalWithPenalties = raw.total_with_penalties_ms ?? raw.totalWithPenaltiesMS ?? raw.totalRaceTimeWithPenalties ?? 0;
  return {
    position: raw.position ?? 0,
    carIndex: raw.car_index ?? raw.carIndex ?? p.car_index,
    driverName: raw.driver_name ?? raw.driverName ?? p.name,
    teamName: raw.team_name ?? raw.teamName ?? '',
    teamId: raw.team_id ?? raw.teamId ?? p.team_id,
    raceNumber: raw.race_number ?? raw.raceNumber ?? p.race_number,
    gridPosition: raw.grid_position ?? raw.gridPosition ?? p.grid_position,
    positionsGained: raw.positions_gained ?? raw.positionsGained,
    bestLapTimeMS: raw.best_lap_time_ms ?? raw.bestLapTimeMS ?? 0,
    bestLapNumber: raw.best_lap_number ?? raw.bestLapNumber,
    bestLapId: raw.best_lap_id ?? raw.bestLapId,
    bestLapS1MS: raw.best_lap_s1_ms ?? raw.bestLapS1MS,
    bestLapS2MS: raw.best_lap_s2_ms ?? raw.bestLapS2MS,
    bestLapS3MS: raw.best_lap_s3_ms ?? raw.bestLapS3MS,
    lastLapTimeMS: raw.last_lap_time_ms ?? raw.lastLapTimeMS ?? 0,
    totalRaceTimeMS: raw.total_race_time_ms ?? raw.totalRaceTimeMS ?? 0,
    totalWithPenaltiesMS: totalWithPenalties,
    totalRaceTimeWithPenalties: totalWithPenalties,
    penaltySeconds: raw.penalty_seconds ?? raw.penaltySeconds ?? 0,
    points: raw.points,
    isDNF: raw.is_dnf ?? raw.isDNF ?? false,
    isDSQ: raw.is_dsq ?? raw.isDSQ ?? false,
    resultReason: raw.result_reason ?? raw.resultReason,
    maxSpeed: raw.max_speed ?? raw.maxSpeed ?? 0,
    bestS1MS: raw.best_s1_ms ?? raw.bestS1MS ?? 0,
    bestS2MS: raw.best_s2_ms ?? raw.bestS2MS ?? 0,
    bestS3MS: raw.best_s3_ms ?? raw.bestS3MS ?? 0,
    theoreticalBestMS: raw.theoretical_best_ms ?? raw.theoreticalBestMS ?? 0,
    gapToLeaderMS: raw.gap_to_leader_ms ?? raw.gapToLeaderMS,
    intervalMS: raw.interval_ms ?? raw.intervalMS,
    lapsCompleted: raw.laps_completed ?? raw.lapsCompleted ?? (raw.laps?.length || 0),
    pitStopsCount: raw.pit_stops_count ?? raw.pitStopsCount,
    stintsSummary: raw.stints_summary ?? raw.stintsSummary,
    aiControlled: raw.ai_controlled ?? raw.aiControlled ?? p.ai_controlled,
    bestLap: raw.best_lap ?? raw.bestLap ?? null,
    lastLap: raw.last_lap ?? raw.lastLap ?? null,
    participant: p,
    laps: raw.laps || [],
  };
}

export interface ClassificationResponse {
  standings: RawDriverStanding[];
  session_best_s1_ms: number;
  session_best_s2_ms: number;
  session_best_s3_ms: number;
  ultimate_theoretical_ms: number;
  actual_best_lap_ms: number;
  actual_best_lap_driver: string;
  speed_rankings: SpeedRanking[];
}

export interface ProgressionDriverMeta {
  car_index: number;
  driver_name: string;
  race_number: number;
  team_id: number;
  team_color: string;
}

export interface ProgressionResponse {
  lap_pace: Array<{ lapNumber: number; [key: string]: number | string | null | undefined }>;
  positions: Array<{ lapNumber: number; [key: string]: number | string | null | undefined }>;
  gap_to_leader: Array<{ lapNumber: number; [key: string]: number | string | null | undefined }>;
  drivers: ProgressionDriverMeta[];
  total_session_laps: number;
}

export interface RawDriverStint {
  stint_index: number;
  stint_id: number;
  compound: string;
  actual_compound?: string;
  start_lap: number;
  end_lap: number;
  total_laps: number;
  avg_lap_time_ms: number;
  best_lap_time_ms: number;
  has_pit_stop_after: boolean;
  deg_slope_sec_per_lap?: number | null;
  laps?: Lap[];
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
  laps?: Lap[];
}

export interface DriverStintData {
  car_index: number;
  driver_name: string;
  race_number: number;
  team_id: number;
  position: number;
  strategy_string: string;
  total_stints: number;
  total_pits: number;
  stints: RawDriverStint[];
}

export interface StintLongestSummary {
  driver_name: string;
  car_index: number;
  race_number: number;
  compound: string;
  total_laps: number;
}

export interface CompoundBestLap {
  time_ms: number;
  driver_name: string;
  car_index: number;
}

export interface StintKPIs {
  most_popular_strategy: string;
  most_popular_count: number;
  longest_stint?: StintLongestSummary | null;
  best_laps_by_compound: Record<string, CompoundBestLap>;
  total_field_pit_stops: number;
}

export interface StintsResponse {
  drivers: DriverStintData[];
  kpis: StintKPIs;
  degradation_data: Array<{ tyreAge: number; [key: string]: number | string | null | undefined }>;
  max_tyre_age: number;
  degradation_rates: Record<string, number | null>;
  session_compounds: string[];
  effective_max_laps: number;
}

export interface NavigationComparatorPayload {
  sessionAId?: number;
  lapAId?: number;
  sessionBId?: number;
  lapBId?: number;
  sessionId?: number;
  lapId?: number;
  slot?: 'A' | 'B';
}
