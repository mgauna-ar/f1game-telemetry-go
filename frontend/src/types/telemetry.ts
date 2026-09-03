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

export interface WeatherForecastSample {
  SessionType?: number;
  session_type?: number;
  TimeOffset?: number; // in minutes (0, 5, 10, 15, 30)
  time_offset?: number;
  Weather?: number; // 0: Clear, 1: Light Cloud, 2: Overcast, 3: Light Rain, 4: Heavy Rain, 5: Storm
  weather?: number;
  TrackTemperature?: number;
  track_temperature?: number;
  TrackTemperatureChange?: number; // 0 = up, 1 = down, 2 = no change
  track_temperature_change?: number;
  AirTemperature?: number;
  air_temperature?: number;
  AirTemperatureChange?: number;
  air_temperature_change?: number;
  RainPercentage?: number;
  rain_percentage?: number;
}

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
  SessionUID?: string | number;
}

export interface RaceEvent {
  id: string;
  timestamp: number;
  sessionTime?: number;
  eventCode: string;
  type: 'fastest_lap' | 'overtake' | 'penalty' | 'speed_trap' | 'pit' | 'retirement' | 'flag' | 'general';
  description: string;
  vehicleIdx?: number;
  driverName?: string;
  otherVehicleIdx?: number;
  targetDriverName?: string;
  lapNum?: number;
  speed?: number;
  lapTime?: number;
  penaltyType?: number;
  infringementType?: number;
  penaltyTime?: number;
  placesGained?: number;
  severity: 'info' | 'warning' | 'danger' | 'purple' | 'success';
}

export interface ParticipantData {
  AIControlled: number;
  DriverId: number;
  NetworkId?: number;
  TeamId: number;
  MyTeam?: number;
  RaceNumber: number;
  Nationality: number;
  Name: string | number[];
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

export interface PacketHeader {
  PacketFormat?: number;
  GameYear?: number;
  PacketId: number;
  SessionTime: number;
  SessionUID?: number | string;
  PlayerCarIndex: number;
}

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

export interface EngineerDirective {
  id: string;
  type: string;
  category: EngineerDirectiveCategory;
  sub_alert?: string;
  title: string;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  car_index: number;
  session_time: number;
  metadata?: Record<string, unknown>;
}

export interface EngineerConfig {
  chatter_cooldown_ms: number;
  smart_discretion_enabled: boolean;
  tyre_wear_warn_pct: number;
  tyre_wear_crit_pct: number;
  tyre_overheat_c: number;
  tyre_cold_c: number;
  wing_damage_warn_pct: number;
  wing_damage_crit_pct: number;
  floor_damage_warn_pct: number;
  engine_wear_warn_pct: number;
  ers_low_pct: number;
  engine_overheat_c: number;
  brake_overheat_c: number;
  brake_cold_c: number;
  fuel_delta_laps: number;
  undercut_gap_sec: number;
  rival_gap_sec: number;
  rival_ahead_gap_sec: number;
  qualy_clean_air_sec: number;
  qualy_time_warn_sec: number;
  corner_cut_warn_threshold: number;
  rain_horizon_min: number;
  rain_prob_pct: number;
  enabled_categories?: Record<string, boolean>;
}

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
  | 'race_finish'
  | 'inlap_traffic_behind'
  | 'inlap_cooldown'
  | 'rival_defend_override'
  | 'rival_attack_override'
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



