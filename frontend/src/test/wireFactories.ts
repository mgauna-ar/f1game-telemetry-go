import type { Lap, Participant, RawDriverStanding, Session, Tag, WeatherForecastSample } from '../types/session';
import { placeholderParticipant } from '../types/session';
import type { GlobalPTTMapping } from '../types/settings';
import type {
  CarDamageData,
  CarStatusData,
  CarTelemetry2Data,
  CarTelemetryData,
  FeedEvent,
  LapData,
  LiveSnapshot,
  ParticipantData,
  SessionData,
} from '../types/telemetry';
import { DRIVER_STATUS, F1_FORMATS, PACKET_IDS, RESULT_STATUS } from '../constants/f1';

// Complete wire objects for tests: the generated types require every field the server always
// sends, so tests set only the fields they care about.

export function makeSession(fields: Partial<Session> = {}): Session {
  return {
    id: 1,
    session_uid: '0x0000000000000001',
    track_id: 0,
    track_name: '',
    session_type: '',
    weather: '',
    weather_forecast: [],
    total_laps: 0,
    ai_difficulty: 0,
    session_duration: 0,
    packet_format: 2025,
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    ...fields,
  };
}

export function makeLap(fields: Partial<Lap> = {}): Lap {
  return {
    id: 1,
    session_id: 1,
    car_index: 0,
    lap_number: 1,
    lap_time_ms: 0,
    sector1_ms: 0,
    sector2_ms: 0,
    sector3_ms: 0,
    is_valid: true,
    tyre_compound: '',
    fuel_load: 0,
    max_speed_kmh: 0,
    penalties_seconds: 0,
    car_position: 0,
    result_status: 0,
    stint: 0,
    actual_compound: '',
    sector1_valid: true,
    sector2_valid: true,
    sector3_valid: true,
    created_at: '2026-01-01T00:00:00Z',
    has_telemetry: false,
    sample_count: 0,
    ...fields,
  };
}

export function makeParticipant(fields: Partial<Participant> = {}): Participant {
  return placeholderParticipant({ id: 1, session_id: 1, ...fields });
}

export function makeTag(fields: Partial<Tag> = {}): Tag {
  return { id: 1, name: '', color: '', created_at: '2026-01-01T00:00:00Z', ...fields };
}

export function makeForecastSample(fields: Partial<WeatherForecastSample> = {}): WeatherForecastSample {
  return {
    SessionType: 0,
    TimeOffset: 0,
    Weather: 0,
    TrackTemperature: 0,
    TrackTemperatureChange: 0,
    AirTemperature: 0,
    AirTemperatureChange: 0,
    RainPercentage: 0,
    ...fields,
  };
}

export function makeFeedEvent(fields: Partial<FeedEvent> = {}): FeedEvent {
  return { eventCode: 'SSTA', type: 'general', severity: 'info', ...fields };
}

// Live snapshot rows (/ws). Numbers default to 0, so tests only set what they check; a lap row
// defaults to a car racing on track, since the server always sends ResultStatus and DriverStatus.

export function makeLiveLap(fields: Partial<LapData> = {}): LapData {
  return {
    LastLapTimeInMS: 0,
    CurrentLapTimeInMS: 0,
    Sector1TimeMSPart: 0,
    Sector2TimeMSPart: 0,
    DeltaToCarInFrontMSPart: 0,
    DeltaToCarInFrontMinutesPart: 0,
    DeltaToRaceLeaderMSPart: 0,
    DeltaToRaceLeaderMinutesPart: 0,
    LapDistance: 0,
    CarPosition: 0,
    CurrentLapNum: 0,
    PitStatus: 0,
    NumPitStops: 0,
    CurrentLapInvalid: 0,
    Penalties: 0,
    TotalWarnings: 0,
    CornerCuttingWarnings: 0,
    NumUnservedDriveThroughPens: 0,
    NumUnservedStopGoPens: 0,
    GridPosition: 0,
    DriverStatus: DRIVER_STATUS.ON_TRACK,
    ResultStatus: RESULT_STATUS.ACTIVE,
    PitLaneTimeInLaneInMS: 0,
    PitStopTimerInMS: 0,
    SpeedTrapFastestSpeed: 0,
    SpeedTrapFastestLap: 0,
    ...fields,
  };
}

export function makeLiveCarStatus(fields: Partial<CarStatusData> = {}): CarStatusData {
  return {
    FuelInTank: 0,
    FuelRemainingLaps: 0,
    ActualTyreCompound: 0,
    VisualTyreCompound: 0,
    TyresAgeLaps: 0,
    ERSStoreEnergy: 0,
    ERSDeployMode: 0,
    ...fields,
  };
}

export function makeLiveCarDamage(fields: Partial<CarDamageData> = {}): CarDamageData {
  return {
    TyresWear: [0, 0, 0, 0],
    FrontLeftWingDamage: 0,
    FrontRightWingDamage: 0,
    FloorDamage: 0,
    DiffuserDamage: 0,
    ...fields,
  };
}

export function makeLiveCarTelemetry(fields: Partial<CarTelemetryData> = {}): CarTelemetryData {
  return {
    Speed: 0,
    BrakesTemperature: [0, 0, 0, 0],
    TyresSurfaceTemperature: [0, 0, 0, 0],
    TyresInnerTemperature: [0, 0, 0, 0],
    EngineTemperature: 0,
    ...fields,
  };
}

export function makeLiveCarTelemetry2(fields: Partial<CarTelemetry2Data> = {}): CarTelemetry2Data {
  return { ActiveAeroMode: 0, OvertakeActive: 0, ...fields };
}

export function makeLiveParticipant(fields: Partial<ParticipantData> = {}): ParticipantData {
  return { AIControlled: 1, DriverId: 0, TeamId: 0, RaceNumber: 0, Name: '', ...fields };
}

export function makeLiveSession(fields: Partial<SessionData> = {}): SessionData {
  return {
    Weather: 0,
    TrackTemperature: 0,
    AirTemperature: 0,
    TotalLaps: 0,
    SessionType: 0,
    TrackId: 0,
    SessionTimeLeft: 0,
    SafetyCarStatus: 0,
    NumRedFlagPeriods: 0,
    PitStopWindowIdealLap: 0,
    PitStopWindowLatestLap: 0,
    PitStopRejoinPosition: 0,
    WeatherForecastSamples: [],
    ...fields,
  };
}

/** A /ws live snapshot; `header` fields override the default 2026 header. */
export function makeLiveSnapshot(
  fields: Partial<Omit<LiveSnapshot, 'Header'>> = {},
  header: Partial<LiveSnapshot['Header']> = {}
): LiveSnapshot {
  return {
    Header: {
      PacketFormat: F1_FORMATS.FORMAT_2026,
      GameYear: 26,
      GameMajorVersion: 1,
      GameMinorVersion: 0,
      PacketVersion: 1,
      PacketId: PACKET_IDS.LIVE_SNAPSHOT,
      SessionUID: '0x0000000000000001',
      SessionTime: 0,
      FrameIdentifier: 0,
      OverallFrameIdentifier: 0,
      PlayerCarIndex: 0,
      SecondaryPlayerCarIndex: 255,
      ...header,
    },
    ...fields,
  };
}

export function makeDriverStanding(fields: Partial<RawDriverStanding> = {}): RawDriverStanding {
  return {
    position: 1,
    car_index: 0,
    driver_name: '',
    team_name: '',
    team_id: 0,
    race_number: 0,
    grid_position: 0,
    best_lap_time_ms: 0,
    best_lap_number: 0,
    best_lap_s1_ms: 0,
    best_lap_s2_ms: 0,
    best_lap_s3_ms: 0,
    last_lap_time_ms: 0,
    total_race_time_ms: 0,
    penalty_seconds: 0,
    total_with_penalties_ms: 0,
    points: 0,
    is_dnf: false,
    is_dsq: false,
    result_reason: 0,
    max_speed: 0,
    best_s1_ms: 0,
    best_s2_ms: 0,
    best_s3_ms: 0,
    theoretical_best_ms: 0,
    gap_to_leader_ms: 0,
    interval_ms: 0,
    laps_completed: 0,
    pit_stops_count: 0,
    stints_summary: '',
    stints: [],
    ai_controlled: false,
    laps: [],
    ...fields,
  };
}

export function makePTTMapping(fields: Partial<GlobalPTTMapping> = {}): GlobalPTTMapping {
  return { device_type: 'none', device_index: 0, button_index: 0, key_code: 0, key_name: '', device_name: '', ...fields };
}
