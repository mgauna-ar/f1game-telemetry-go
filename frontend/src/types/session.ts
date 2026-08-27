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

export interface DriverStanding {
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
  best_s1_ms?: number;
  best_s2_ms?: number;
  best_s3_ms?: number;
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
  theoretical_best_ms?: number;
  gap_to_leader_ms?: number;
  interval_ms?: number;
  pit_stops_count?: number;
  participant: Participant;
  laps: Lap[];
  bestLap: Lap | null;
  bestLapTimeMS: number;
  lastLap?: Lap | null;
  lastLapTimeMS?: number;
  totalRaceTimeMS?: number;
  totalTimeMS?: number;
  penaltySeconds?: number;
  totalRaceTimeWithPenalties?: number;
  officialPos?: number;
  gridPosition?: number;
  positionsGained?: number;
  points?: number;
  resultReason?: number;
  isDNF: boolean;
  isDSQ: boolean;
  maxSpeed: number;
  bestS1MS: number;
  bestS2MS: number;
  bestS3MS: number;
  theoreticalBestMS?: number;
  gapToLeaderMS?: number;
  intervalMS?: number;
  stints?: { compound: string; laps: number }[];
  pitStopsCount?: number;
}

export interface ClassificationResponse {
  standings: DriverStanding[];
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
  lap_pace: Array<{ lapNumber: number; [key: string]: any }>;
  positions: Array<{ lapNumber: number; [key: string]: any }>;
  gap_to_leader: Array<{ lapNumber: number; [key: string]: any }>;
  drivers: ProgressionDriverMeta[];
  total_session_laps: number;
}

export interface DriverStint {
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

export interface DriverStintData {
  car_index: number;
  driver_name: string;
  race_number: number;
  team_id: number;
  position: number;
  strategy_string: string;
  total_stints: number;
  total_pits: number;
  stints: DriverStint[];
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
  degradation_data: Array<{ tyreAge: number; [key: string]: any }>;
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
