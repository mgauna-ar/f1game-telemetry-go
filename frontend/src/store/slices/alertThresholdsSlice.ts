import type { StateCreator } from 'zustand';
import {
  RADIO_ALERT_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
} from '../../constants/f1';
import {
  buildAIConfigFromValues,
  type RadioSettingsState,
} from '../useRadioSettingsStore';

export interface AlertThresholdsSlice {
  tyreWearWarningPct: number;
  tyreWearCriticalPct: number;
  tyreOverheatC: number;
  tyreColdC: number;
  wingDamageWarnPct: number;
  floorDamageWarnPct: number;
  engineWearWarnPct: number;
  ersLowPct: number;
  engineOverheatC: number;
  brakeOverheatC: number;
  brakeColdC: number;
  fuelDeltaLaps: number;
  undercutGapSec: number;
  rivalGapThresholdSec: number;
  rivalAheadGapSec: number;
  qualyCleanAirSec: number;
  cornerCutWarnThreshold: number;
  rainHorizonMin: number;
  rainProbPct: number;

  setTyreWearWarningPct: (pct: number) => void;
  setTyreWearCriticalPct: (pct: number) => void;
  setTyreOverheatC: (temp: number) => void;
  setTyreColdC: (temp: number) => void;
  setWingDamageWarnPct: (pct: number) => void;
  setFloorDamageWarnPct: (pct: number) => void;
  setEngineWearWarnPct: (pct: number) => void;
  setEngineOverheatC: (temp: number) => void;
  setErsLowPct: (pct: number) => void;
  setBrakeOverheatC: (temp: number) => void;
  setBrakeColdC: (temp: number) => void;
  setFuelDeltaLaps: (laps: number) => void;
  setUndercutGapSec: (sec: number) => void;
  setRivalGapThresholdSec: (sec: number) => void;
  setRivalAheadGapSec: (sec: number) => void;
  setQualyCleanAirSec: (sec: number) => void;
  setCornerCutWarnThreshold: (count: number) => void;
  setRainHorizonMin: (min: number) => void;
  setRainProbPct: (pct: number) => void;
}

export function getInitialAlertThresholds(): Omit<
  AlertThresholdsSlice,
  | 'setTyreWearWarningPct'
  | 'setTyreWearCriticalPct'
  | 'setTyreOverheatC'
  | 'setTyreColdC'
  | 'setWingDamageWarnPct'
  | 'setFloorDamageWarnPct'
  | 'setEngineWearWarnPct'
  | 'setEngineOverheatC'
  | 'setErsLowPct'
  | 'setBrakeOverheatC'
  | 'setBrakeColdC'
  | 'setFuelDeltaLaps'
  | 'setUndercutGapSec'
  | 'setRivalGapThresholdSec'
  | 'setRivalAheadGapSec'
  | 'setQualyCleanAirSec'
  | 'setCornerCutWarnThreshold'
  | 'setRainHorizonMin'
  | 'setRainProbPct'
> {
  return {
    tyreWearWarningPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT,
    tyreWearCriticalPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT,
    tyreOverheatC: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_OVERHEAT_C,
    tyreColdC: RADIO_ALERT_CONSTANTS.TYRE_TEMP_COLD_C,
    wingDamageWarnPct: RADIO_ALERT_CONSTANTS.DEFAULT_WING_DAMAGE_WARN_PCT,
    floorDamageWarnPct: RADIO_ALERT_CONSTANTS.DEFAULT_FLOOR_DAMAGE_WARN_PCT,
    engineWearWarnPct: RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_WEAR_WARN_PCT,
    ersLowPct: RADIO_ALERT_CONSTANTS.DEFAULT_ERS_LOW_PCT,
    engineOverheatC: RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_OVERHEAT_C,
    brakeOverheatC: 1000,
    brakeColdC: RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_COLD_C,
    fuelDeltaLaps: RADIO_ALERT_CONSTANTS.DEFAULT_FUEL_DELTA_LAPS,
    undercutGapSec: 3.0,
    rivalGapThresholdSec: RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC,
    rivalAheadGapSec: RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_AHEAD_GAP_SEC,
    qualyCleanAirSec: RADIO_ALERT_CONSTANTS.DEFAULT_QUALY_CLEAN_AIR_SEC,
    cornerCutWarnThreshold: RADIO_ALERT_CONSTANTS.DEFAULT_CORNER_CUT_WARN_THRESHOLD,
    rainHorizonMin: 10,
    rainProbPct: RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_PROB_PCT,
  };
}

export const createAlertThresholdsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  AlertThresholdsSlice
> = (set, get) => {
  const createThresholdAction =
    (field: keyof AlertThresholdsSlice, min?: number, max?: number) =>
    (val: number) => {
      let clamped = val;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;

      set((state) => {
        const nextState = {
          ...state,
          [field]: clamped,
          triggerPreset: RADIO_TRIGGER_PRESETS.CUSTOM,
        };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState),
        };
      });
      get().syncConfigToBackend();
    };

  return {
    ...getInitialAlertThresholds(),

    setTyreWearWarningPct: createThresholdAction('tyreWearWarningPct', 20, 80),
    setTyreWearCriticalPct: createThresholdAction('tyreWearCriticalPct', 50, 95),
    setTyreOverheatC: createThresholdAction('tyreOverheatC', 90, 140),
    setTyreColdC: createThresholdAction('tyreColdC', 50, 100),
    setWingDamageWarnPct: createThresholdAction('wingDamageWarnPct', 5, 50),
    setFloorDamageWarnPct: createThresholdAction('floorDamageWarnPct', 10, 60),
    setEngineWearWarnPct: createThresholdAction('engineWearWarnPct', 40, 90),
    setEngineOverheatC: createThresholdAction('engineOverheatC', 105, 145),
    setErsLowPct: createThresholdAction('ersLowPct', 5, 40),
    setBrakeOverheatC: createThresholdAction('brakeOverheatC', 600, 1200),
    setBrakeColdC: createThresholdAction('brakeColdC', 50, 400),
    setFuelDeltaLaps: createThresholdAction('fuelDeltaLaps', -3.0, 0.0),
    setUndercutGapSec: createThresholdAction('undercutGapSec', 1.0, 5.0),
    setRivalGapThresholdSec: createThresholdAction('rivalGapThresholdSec', 0.5, 3.0),
    setRivalAheadGapSec: createThresholdAction('rivalAheadGapSec', 0.5, 3.0),
    setQualyCleanAirSec: createThresholdAction('qualyCleanAirSec', 1.5, 7.0),
    setCornerCutWarnThreshold: createThresholdAction('cornerCutWarnThreshold', 1, 3),
    setRainHorizonMin: createThresholdAction('rainHorizonMin', 5, 30),
    setRainProbPct: createThresholdAction('rainProbPct', 20, 80),
  };
};
