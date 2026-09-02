import type { StateCreator } from 'zustand';
import {
  RADIO_ALERT_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
  type RadioTriggerPreset,
} from '../../constants/f1';
import {
  buildAIConfigFromValues,
  type RadioSettingsState,
} from '../useRadioSettingsStore';

export interface RadioPresetsSlice {
  triggerPreset: RadioTriggerPreset;

  applyTriggerPreset: (preset: RadioTriggerPreset) => void;
  resetTriggerDefaults: () => void;
}

export function getInitialRadioPresets(): Omit<
  RadioPresetsSlice,
  'applyTriggerPreset' | 'resetTriggerDefaults'
> {
  return {
    triggerPreset: RADIO_TRIGGER_PRESETS.IMMERSIVE,
  };
}

export const createRadioPresetsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  RadioPresetsSlice
> = (set, get) => ({
  ...getInitialRadioPresets(),

  applyTriggerPreset: (preset) => {
    let partial: Partial<RadioSettingsState> = {};
    if (preset === RADIO_TRIGGER_PRESETS.IMMERSIVE) {
      partial = {
        triggerPreset: preset,
        tyreAlertsEnabled: true,
        thermalAlertsEnabled: true,
        damageAlertsEnabled: true,
        ersAlertsEnabled: true,
        brakesAlertsEnabled: true,
        fuelAlertsEnabled: true,
        rivalAlertsEnabled: true,
        pitWindowAlertsEnabled: true,
        trackAlertsEnabled: true,
        qualyAlertsEnabled: true,
        flagsPensAlertsEnabled: true,
        chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL,
        subTyreWear: true,
        subTyrePuncture: true,
        subTyreThermal: false,
        subTyreCold: false,
        subDamageWing: true,
        subDamageFloor: false,
        subDamageEngine: false,
        subDamageFaults: true,
        subErsLow: false,
        subEngineTemp: false,
        subBrakeTemp: false,
        subBrakeCold: false,
        subFuelDelta: false,
        subUndercut: true,
        subPitWindow: false,
        subRivalDefend: false,
        subRivalAttack: false,
        subQualyTraffic: false,
        subQualyInvalid: true,
        subQualyTime: false,
        subQualyElim: false,
        subSafetyCar: true,
        subRedFlag: true,
        subRain: true,
        subTrackLimits: false,
        subPenalties: true,
      };
    } else if (preset === RADIO_TRIGGER_PRESETS.COACHING) {
      partial = {
        triggerPreset: preset,
        tyreAlertsEnabled: true,
        thermalAlertsEnabled: true,
        damageAlertsEnabled: true,
        ersAlertsEnabled: true,
        brakesAlertsEnabled: true,
        fuelAlertsEnabled: true,
        rivalAlertsEnabled: true,
        pitWindowAlertsEnabled: true,
        trackAlertsEnabled: true,
        qualyAlertsEnabled: true,
        flagsPensAlertsEnabled: true,
        chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.TALKATIVE,
        subTyreWear: true,
        subTyrePuncture: true,
        subTyreThermal: true,
        subTyreCold: true,
        subDamageWing: true,
        subDamageFloor: true,
        subDamageEngine: true,
        subDamageFaults: true,
        subErsLow: true,
        subEngineTemp: true,
        subBrakeTemp: true,
        subBrakeCold: true,
        subFuelDelta: true,
        subUndercut: true,
        subPitWindow: true,
        subRivalDefend: true,
        subRivalAttack: true,
        subQualyTraffic: true,
        subQualyInvalid: true,
        subQualyTime: true,
        subQualyElim: true,
        subSafetyCar: true,
        subRedFlag: true,
        subRain: true,
        subTrackLimits: true,
        subPenalties: true,
      };
    } else if (preset === RADIO_TRIGGER_PRESETS.MINIMAL) {
      partial = {
        triggerPreset: preset,
        tyreAlertsEnabled: true,
        thermalAlertsEnabled: false,
        damageAlertsEnabled: true,
        ersAlertsEnabled: false,
        brakesAlertsEnabled: false,
        fuelAlertsEnabled: false,
        rivalAlertsEnabled: false,
        pitWindowAlertsEnabled: false,
        trackAlertsEnabled: false,
        qualyAlertsEnabled: false,
        flagsPensAlertsEnabled: true,
        chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.MINIMAL,
        subTyreWear: false,
        subTyrePuncture: true,
        subTyreThermal: false,
        subTyreCold: false,
        subDamageWing: true,
        subDamageFloor: false,
        subDamageEngine: false,
        subDamageFaults: true,
        subErsLow: false,
        subEngineTemp: false,
        subBrakeTemp: false,
        subBrakeCold: false,
        subFuelDelta: false,
        subUndercut: false,
        subPitWindow: false,
        subRivalDefend: false,
        subRivalAttack: false,
        subQualyTraffic: false,
        subQualyInvalid: false,
        subQualyTime: false,
        subQualyElim: false,
        subSafetyCar: true,
        subRedFlag: true,
        subRain: false,
        subTrackLimits: false,
        subPenalties: true,
      };
    } else {
      partial = { triggerPreset: preset };
    }

    set((state) => {
      const nextState = { ...state, ...partial };
      return {
        ...nextState,
        aiConfig: buildAIConfigFromValues(nextState),
      };
    });
    get().syncConfigToBackend();
  },

  resetTriggerDefaults: () => {
    get().applyTriggerPreset(RADIO_TRIGGER_PRESETS.IMMERSIVE);
    const resetThresholds = {
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
    set((state) => {
      const nextState = { ...state, ...resetThresholds };
      return {
        ...nextState,
        aiConfig: buildAIConfigFromValues(nextState),
      };
    });
    get().syncConfigToBackend();
  },
});
