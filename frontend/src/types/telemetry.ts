export interface CarMotionData {
  WorldPositionX: number;
  WorldPositionY: number;
  WorldPositionZ: number;
}

import type { WeatherForecastSample } from './generated/packets';
import type { FeedEvent, LiveCarTelemetry, LiveSession } from './generated/session';
export type { WeatherForecastSample };

/**
 * The /ws live snapshot and its per-car rows, generated from `internal/session/live_snapshot.go`.
 * They carry only the fields the live views read; a new field is added to the Go DTO first.
 */
export type {
  LiveSnapshot,
  LiveLapData as LapData,
  LiveCarStatus as CarStatusData,
  LiveCarDamage as CarDamageData,
  LiveCarTelemetry as CarTelemetryData,
  LiveCarTelemetry2 as CarTelemetry2Data,
  LiveParticipant as ParticipantData,
  LiveGapTrend as GapTrend,
  LiveLapTimes as LapTimes,
} from './generated/session';

/** The live session, plus the packet format and session UID the store copies from the snapshot header. */
export type SessionData = LiveSession & {
  PacketFormat?: number;
  /** Hex string (e.g. "0x1a2b..."), from the packet header. */
  SessionUID?: string;
};

/**
 * One race feed row: the server's FeedEvent (an event code and its parameters, no text) plus the
 * id and receive time the dashboard adds. `utils/raceEvents.ts` writes its text.
 */
export type RaceEvent = FeedEvent & {
  id: string;
  timestamp: number;
};

export type { FeedEvent, FeedEventCode, FeedEventType, FeedSeverity } from './generated/session';

export type { PacketHeader } from './generated/packets';

/** GET /api/live/cars/{carIndex}/laps: a car's completed laps and stints in the live session. */
export type { LiveCarLap, LiveCarLaps, LiveCarStint } from './generated/api';

export interface TelemetrySample extends LiveCarTelemetry {
  SessionTime: number;
  active_aero_mode?: number;
  active_aero_available?: number;
  overtake_active?: number;
}

/**
 * A radio directive from /ws/engineer. It carries the alert key and no text: the dashboard speaks
 * the call from its phrase catalog (`utils/radioPhrases.ts`).
 */
export type {
  DirectiveValues,
  EngineerAlertKey,
  EngineerBoxTiming,
  EngineerDirective,
  EngineerDirectiveCategory,
  EngineerGapTrend,
  EngineerUrgency,
  GapToCar,
} from './generated/engineer';
import type { DirectiveValues, EngineerBoxTiming } from './generated/engineer';

/** How a call that mentions pitting puts it: an order to box, or a stop the team offers. */
export type BoxCallKind = 'instruction' | 'option';

/** The parts a report's numbers are said with (each locale's `report_phrases`). */
export type ReportPhrase =
  | 'position'
  | 'leading'
  | 'ahead'
  | 'ahead_closing'
  | 'ahead_opening'
  | 'ahead_stable'
  | 'behind'
  | 'behind_closing'
  | 'behind_opening'
  | 'behind_stable'
  | 'nobody_close'
  | 'tyre_life_one_lap'
  | 'elimination_drop_zone'
  | 'elimination_last_through';

/** Every message /ws/engineer sends, told apart by `type`. */
export type {
  EngineerSocketMessage,
  PTTEventMessage,
  PTTLearnedMessage,
  PTTLearnTimeoutMessage,
  SettingsChangedMessage,
} from './generated/api';

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
  | 'ers_fault'
  | 'aero_fault'
  | 'ers_low'
  | 'radiator_overheat'
  | 'brake_overheat'
  | 'brake_cold'
  | 'fuel_deficit'
  | 'undercut_window'
  | 'pit_clean_air'
  | 'pit_entry_reminder'
  | 'pit_window_open'
  | 'rival_defend'
  | 'rival_attack'
  | 'sector_delta'
  | 'teammate_ahead'
  | 'teammate_pitting'
  | 'qualy_traffic'
  | 'qualy_clean_air'
  | 'qualy_deleted_lap'
  | 'qualy_traffic_ahead'
  | 'qualy_session_time'
  | 'qualy_session_time_garage'
  | 'qualy_elimination_danger'
  | 'qualy_elimination_bubble'
  | 'qualy_lap_pole'
  | 'qualy_lap_result'
  | 'qualy_lap_no_improvement'
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
  | 'gap_report'
  | 'tyre_life'
  | 'tyre_life_end'
  | 'race_finish_win'
  | 'race_finish_podium'
  | 'race_finish_points'
  | 'penalty_drive_through'
  | 'penalty_stop_go'
  | 'start_reaction_fast'
  | 'start_reaction_slow'
  | 'pit_stop_fast'
  | 'pit_stop_slow'
  | 'tyre_wear_critical'
  | 'rival_defend_drs'
  | 'rival_attack_drs';

/**
 * The phrases one radio category can speak, per persona. Bono and Colapinto fall back to
 * `standard` when their pool is missing or empty, and the custom persona always uses it.
 * `{driver}` is replaced by the driver's callsign.
 */
export interface RadioPhrasePool {
  bono?: string[];
  colapinto?: string[];
  standard: string[];
}

/** A proactive radio call for the speech queue: the phrase category to speak and how urgently. */
export interface RadioAlertPayload {
  category: RadioAlertCategory;
  isCritical: boolean;
  emotion: RadioEmotion;
  /** How long the call stays worth saying while it waits behind other speech (ms). */
  ttlMs?: number;
  /** When the driver can pit, on a call that asks them to. */
  box?: EngineerBoxTiming;
  /** The numbers a report says (gap report, tyre life). */
  values?: DirectiveValues;
}

export interface RadioEmotion {
  rateModifier?: number;
  pitchModifier?: number;
}



