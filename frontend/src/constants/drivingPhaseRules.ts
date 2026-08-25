import { RADIO_ALERT_CONSTANTS } from './f1';

export const DRIVING_PHASES = {
  RED_FLAG: 'RED_FLAG',
  IN_GARAGE: 'IN_GARAGE',
  PIT_LANE: 'PIT_LANE',
  FORMATION_LAP: 'FORMATION_LAP',
  SAFETY_CAR: 'SAFETY_CAR',
  OUT_LAP: 'OUT_LAP',
  IN_LAP: 'IN_LAP',
  FLYING_LAP: 'FLYING_LAP',
  RACING: 'RACING',
  UNKNOWN: 'UNKNOWN',
} as const;

export type DrivingPhase = (typeof DRIVING_PHASES)[keyof typeof DRIVING_PHASES];
export const DrivingPhase = DRIVING_PHASES;

export type DedupScope = 'stint' | 'phase' | 'lap' | 'none';

export interface AlertPhaseRule {
  validPhases: readonly DrivingPhase[];
  minLapDistancePct?: number; // Minimum track completion % on out-lap before firing (0.0 - 1.0)
  suppressAfterPitForLaps?: number; // Number of laps to suppress after leaving pit box
  dedupScope: DedupScope;
}

export const ALERT_PHASE_RULES: Record<string, AlertPhaseRule> = {
  tyre_wear: {
    validPhases: [DrivingPhase.FLYING_LAP, DrivingPhase.RACING, DrivingPhase.IN_LAP, DrivingPhase.SAFETY_CAR],
    dedupScope: 'stint',
  },
  tyre_puncture: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'stint',
  },
  tyre_overheat: {
    validPhases: [DrivingPhase.OUT_LAP, DrivingPhase.FLYING_LAP, DrivingPhase.RACING, DrivingPhase.IN_LAP],
    dedupScope: 'stint',
  },
  tyre_cold: {
    validPhases: [DrivingPhase.OUT_LAP, DrivingPhase.FORMATION_LAP, DrivingPhase.SAFETY_CAR],
    minLapDistancePct: RADIO_ALERT_CONSTANTS.MIN_OUT_LAP_DISTANCE_PCT,
    dedupScope: 'phase',
  },
  damage_wing: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'stint',
  },
  damage_floor: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'stint',
  },
  damage_engine: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'stint',
  },
  damage_faults: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'stint',
  },
  ers_low: {
    validPhases: [DrivingPhase.FLYING_LAP, DrivingPhase.RACING],
    dedupScope: 'lap',
  },
  engine_temp: {
    validPhases: [DrivingPhase.OUT_LAP, DrivingPhase.FLYING_LAP, DrivingPhase.RACING, DrivingPhase.IN_LAP],
    dedupScope: 'stint',
  },
  brake_hot: {
    validPhases: [DrivingPhase.OUT_LAP, DrivingPhase.FLYING_LAP, DrivingPhase.RACING],
    dedupScope: 'stint',
  },
  brake_cold: {
    validPhases: [DrivingPhase.FORMATION_LAP, DrivingPhase.SAFETY_CAR],
    dedupScope: 'phase',
  },
  fuel_delta: {
    validPhases: [DrivingPhase.RACING, DrivingPhase.IN_LAP, DrivingPhase.SAFETY_CAR],
    dedupScope: 'lap',
  },
  undercut: {
    validPhases: [DrivingPhase.RACING, DrivingPhase.IN_LAP, DrivingPhase.SAFETY_CAR],
    dedupScope: 'stint',
  },
  pit_window: {
    validPhases: [DrivingPhase.RACING, DrivingPhase.IN_LAP, DrivingPhase.SAFETY_CAR],
    dedupScope: 'lap',
  },
  rival_defend: {
    validPhases: [DrivingPhase.RACING],
    suppressAfterPitForLaps: RADIO_ALERT_CONSTANTS.POST_PIT_SUPPRESSION_LAPS,
    dedupScope: 'none',
  },
  rival_attack: {
    validPhases: [DrivingPhase.RACING],
    suppressAfterPitForLaps: RADIO_ALERT_CONSTANTS.POST_PIT_SUPPRESSION_LAPS,
    dedupScope: 'none',
  },
  qualy_invalid: {
    validPhases: [DrivingPhase.OUT_LAP, DrivingPhase.FLYING_LAP],
    dedupScope: 'lap',
  },
  qualy_traffic: {
    validPhases: [DrivingPhase.OUT_LAP],
    minLapDistancePct: 0.5,
    dedupScope: 'lap',
  },
  qualy_time: {
    validPhases: [
      DrivingPhase.IN_GARAGE,
      DrivingPhase.PIT_LANE,
      DrivingPhase.OUT_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
    ],
    dedupScope: 'phase',
  },
  qualy_elim: {
    validPhases: [
      DrivingPhase.IN_GARAGE,
      DrivingPhase.PIT_LANE,
      DrivingPhase.OUT_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
    ],
    dedupScope: 'phase',
  },
  flags_sc: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
      DrivingPhase.RED_FLAG,
    ],
    dedupScope: 'phase',
  },
  flags_red: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
      DrivingPhase.RED_FLAG,
    ],
    dedupScope: 'phase',
  },
  flags_rain: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'phase',
  },
  track_limits: {
    validPhases: [DrivingPhase.FLYING_LAP, DrivingPhase.RACING],
    dedupScope: 'lap',
  },
  penalties: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'none',
  },
  backend_directive: {
    validPhases: [
      DrivingPhase.OUT_LAP,
      DrivingPhase.FORMATION_LAP,
      DrivingPhase.FLYING_LAP,
      DrivingPhase.RACING,
      DrivingPhase.IN_LAP,
      DrivingPhase.SAFETY_CAR,
    ],
    dedupScope: 'none',
  },
};
