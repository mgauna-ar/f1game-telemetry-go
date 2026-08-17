export interface Session {
  id: number;
  session_uid: string | number;
  track_id?: number;
  track_name: string;
  session_type: string;
  weather?: string;
  packet_format?: number;
  created_at: string;
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
  fuel_load?: number;
  max_speed_kmh?: number;
  penalties_seconds?: number;
  car_position?: number;
  result_status?: number;
  stint?: number;
  created_at?: string;
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

export interface NavigationComparatorPayload {
  sessionAId?: number;
  lapAId?: number;
  sessionBId?: number;
  lapBId?: number;
  sessionId?: number;
  lapId?: number;
  slot?: 'A' | 'B';
}
