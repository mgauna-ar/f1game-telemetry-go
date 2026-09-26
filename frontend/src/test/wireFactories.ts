import type { Lap, Participant, RawDriverStanding, Session, Tag, WeatherForecastSample } from '../types/session';
import { placeholderParticipant } from '../types/session';
import type { GlobalPTTMapping } from '../types/settings';
import type { FeedEvent } from '../types/telemetry';

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
