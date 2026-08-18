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
  SessionType: number;
  TimeOffset: number; // in minutes (0, 5, 10, 15, 30)
  Weather: number; // 0: Clear, 1: Light Cloud, 2: Overcast, 3: Light Rain, 4: Heavy Rain, 5: Storm
  TrackTemperature: number;
  TrackTemperatureChange: number; // 0 = up, 1 = down, 2 = no change
  AirTemperature: number;
  AirTemperatureChange: number;
  RainPercentage: number;
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
