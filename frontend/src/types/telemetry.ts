export interface CarTelemetryData {
  Speed: number;
  Throttle: number;
  Steer: number;
  Brake: number;
  Clutch: number;
  Gear: number;
  EngineRPM: number;
  DRS: number;
  RevLightsPercent: number;
  BrakesTemperature?: [number, number, number, number];
  TyresSurfaceTemperature?: [number, number, number, number];
  TyresInnerTemperature?: [number, number, number, number];
  EngineTemperature?: number;
  TyresPressure?: [number, number, number, number];
}

export interface LapData {
  LastLapTimeInMS: number;
  CurrentLapTimeInMS: number;
  Sector1TimeMSPart: number;
  Sector1TimeMinutesPart?: number;
  Sector2TimeMSPart: number;
  Sector2TimeMinutesPart?: number;
  DeltaToCarInFrontMSPart?: number;
  DeltaToCarInFrontMinutesPart?: number;
  DeltaToRaceLeaderMSPart?: number;
  DeltaToRaceLeaderMinutesPart?: number;
  SafetyCarDelta?: number;
  CarPosition: number;
  CurrentLapNum: number;
  PitStatus: number;
  NumPitStops?: number;
  Sector?: number;
  CurrentLapInvalid: number;
  DriverStatus?: number;
  ResultStatus?: number;
  LapDistance?: number;
  TotalDistance?: number;
  Penalties?: number;
  TotalWarnings?: number;
  CornerCuttingWarnings?: number;
  GridPosition?: number;
  PitLaneTimerActive?: number;
  PitLaneTimeInLaneInMS?: number;
  PitStopTimerInMS?: number;
  SpeedTrapFastestSpeed?: number;
  SpeedTrapFastestLap?: number;
  NumUnservedDriveThroughPens?: number;
  NumUnservedStopGoPens?: number;
}

export interface CarMotionData {
  WorldPositionX: number;
  WorldPositionY: number;
  WorldPositionZ: number;
}

import type { EngineerDirective as GeneratedEngineerDirective } from './generated/engineer';
import type { WeatherForecastSample } from './generated/packets';
import type { FeedEvent } from './generated/session';
import type { Narrows } from './wire';
export type { WeatherForecastSample };

export interface SessionData {
  Weather: number;
  TrackTemperature: number;
  AirTemperature: number;
  TotalLaps: number;
  TrackLength: number;
  SessionType: number;
  TrackId: number;
  SessionTimeLeft: number;
  SessionDuration: number;
  SafetyCarStatus: number;
  PitStopWindowIdealLap?: number;
  PitStopWindowLatestLap?: number;
  PitStopRejoinPosition?: number;
  NumWeatherForecastSamples?: number;
  WeatherForecastSamples?: WeatherForecastSample[];
  NumSafetyCarPeriods?: number;
  NumVirtualSafetyCarPeriods?: number;
  NumRedFlagPeriods?: number;
  PacketFormat?: number;
  GamePaused?: number;
  /** Hex string (e.g. "0x1a2b..."), from the packet header. */
  SessionUID?: string;
}

/**
 * One race feed row: the server's FeedEvent (an event code and its parameters, no text) plus the
 * id and receive time the dashboard adds. `utils/raceEvents.ts` writes its text.
 */
export type RaceEvent = FeedEvent & {
  id: string;
  timestamp: number;
};

export type { FeedEvent, FeedEventCode, FeedEventType, FeedSeverity } from './generated/session';

export interface ParticipantData {
  AIControlled: number;
  DriverId: number;
  NetworkId?: number;
  TeamId: number;
  MyTeam?: number;
  RaceNumber: number;
  Nationality: number;
  Name: string;
}

export interface CarStatusData {
  FuelInTank: number;
  FuelCapacity?: number;
  FuelRemainingLaps?: number;
  EngineCoolantTemperature?: number;
  VisualTyreCompound: number;
  ActualTyreCompound?: number;
  TyresAgeLaps?: number;
  ERSStoreEnergy: number;
  ERSDeployMode: number;
  ERSHarvestedThisLapMGUK?: number;
  ERSHarvestedThisLapMGUH?: number;
  ERSDeployedThisLap?: number;
}

export interface CarDamageData {
  TyresWear: [number, number, number, number]; // RL, RR, FL, FR
  TyresDamage: [number, number, number, number];
  BrakesDamage: [number, number, number, number];
  FrontLeftWingDamage: number;
  FrontRightWingDamage: number;
  RearWingDamage: number;
  FloorDamage: number;
  DiffuserDamage: number;
  SidepodDamage: number;
  DRSFault: number;
  ERSFault: number;
  GearBoxDamage: number;
  EngineDamage: number;
  EngineMGUHWear: number;
  EngineESWear: number;
  EngineCEWear: number;
  EngineICEWear: number;
  EngineMGUKWear: number;
  EngineTCWear: number;
  EngineBlown: number;
  EngineSeized: number;
}

export type { PacketHeader } from './generated/packets';

export interface CarTelemetry2Data {
  ActiveAeroMode: number;
  ActiveAeroAvailable: number;
  ActiveAeroActivationDistance: number;
  OvertakeAvailable: number;
  OvertakeActive: number;
  OvertakeActivationDistance: number;
  Regulations2026: number;
  DrivingWrongWay: number;
}

export interface TelemetrySample extends CarTelemetryData {
  SessionTime: number;
  active_aero_mode?: number;
  active_aero_available?: number;
  overtake_active?: number;
}

export type EngineerDirectiveCategory =
  | 'pit_strategy'
  | 'coaching'
  | 'weather'
  | 'teammate'
  | 'tyres'
  | 'damage'
  | 'ers'
  | 'brakes'
  | 'fuel'
  | 'rivals'
  | 'qualy'
  | 'flags';

/** A radio directive from /ws/engineer, with the category and urgency the dashboard knows. */
export type EngineerDirective = Narrows<
  Omit<GeneratedEngineerDirective, 'category' | 'urgency'> & {
    category: EngineerDirectiveCategory;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  },
  GeneratedEngineerDirective
>;

/** Every message /ws/engineer sends, told apart by `type`. */
export type {
  EngineerSocketMessage,
  PTTEventMessage,
  PTTLearnedMessage,
  PTTLearnTimeoutMessage,
} from './generated/api';

export type { EngineerConfig } from './generated/engineer';

export type RadioAlertCategory =
  | 'safety_car'
  | 'vsc'
  | 'red_flag'
  | 'tyre_puncture'
  | 'tyre_wear'
  | 'tyre_overheat'
  | 'tyre_cold'
  | 'wing_damage'
  | 'floor_damage'
  | 'engine_wear'
  | 'mechanical_fault'
  | 'ers_fault'
  | 'aero_fault'
  | 'ers_low'
  | 'radiator_overheat'
  | 'brake_overheat'
  | 'brake_cold'
  | 'fuel_deficit'
  | 'undercut_window'
  | 'pit_clean_air'
  | 'pit_window_open'
  | 'rival_defend'
  | 'rival_attack'
  | 'sector_delta'
  | 'teammate_ahead'
  | 'teammate_pitting'
  | 'qualy_traffic'
  | 'qualy_clean_air'
  | 'qualy_deleted_lap'
  | 'qualy_session_time'
  | 'qualy_elimination_danger'
  | 'track_limits_warnings'
  | 'penalties_incurred'
  | 'weather_rain'
  | 'flags_rain_live'
  | 'tyre_crossover'
  | 'flags_sc_in'
  | 'flags_green'
  | 'flags_blue'
  | 'flags_yellow'
  | 'pit_window_close'
  | 'teammate_doublestack'
  | 'terminal_engine'
  | 'brake_bias'
  | 'wrong_way'
  | 'race_finish'
  | 'inlap_traffic_behind'
  | 'inlap_cooldown'
  | 'rival_defend_override'
  | 'rival_attack_override'
  | 'flags_drs_enabled'
  | 'flags_drs_disabled'
  | 'race_fastest_lap'
  | 'car_collision'
  | 'car_retirement'
  | 'formation_lap_start'
  | 'grid_approach'
  | 'start_reaction_time'
  | 'pit_serve_penalty'
  | 'pit_stop_duration'
  | 'pit_limiter_exit'
  | 'tyre_crossover_wet'
  | 'tyre_crossover_inter'
  | 'brake_bias_ok'
  | 'fuel_mix_neutralized'
  | 'fuel_mix_restart'
  | 'ers_clipping'
  | 'tyre_set_advisory'
  | 'aero_straight_anticipation'
  | 'overtake_boost_anticipation'
  | 'pit_limiter_overspeed'
  | 'tyre_blistering'
  | 'tyre_pressure_high'
  | 'damage_gearbox_wear'
  | 'damage_ice_wear'
  | 'directive';

export interface RadioAlertPayload {
  category: RadioAlertCategory;
  isCritical?: boolean;
  alertKey?: string;
  subsystem?: string;
  message?: string;
  emotion?: {
    rateModifier?: number;
    pitchModifier?: number;
  };
  metadata?: Record<string, unknown>;
}



