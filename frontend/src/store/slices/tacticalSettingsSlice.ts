import type { StateCreator } from 'zustand';
import {
  RADIO_ALERT_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
} from '../../constants/f1';
import {
  buildAIConfigFromValues,
  type RadioSettingsState,
} from '../useRadioSettingsStore';

export interface TacticalSettingsSlice {
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;

  // Subsystem master switches
  tyreAlertsEnabled: boolean;
  thermalAlertsEnabled: boolean;
  damageAlertsEnabled: boolean;
  ersAlertsEnabled: boolean;
  brakesAlertsEnabled: boolean;
  fuelAlertsEnabled: boolean;
  rivalAlertsEnabled: boolean;
  pitWindowAlertsEnabled: boolean;
  trackAlertsEnabled: boolean;
  qualyAlertsEnabled: boolean;
  flagsPensAlertsEnabled: boolean;

  // Sub-alert individual toggles
  subTyreWear: boolean;
  subTyrePuncture: boolean;
  subTyreThermal: boolean;
  subTyreCold: boolean;
  subDamageWing: boolean;
  subDamageFloor: boolean;
  subDamageEngine: boolean;
  subDamageFaults: boolean;
  subErsLow: boolean;
  subEngineTemp: boolean;
  subBrakeTemp: boolean;
  subBrakeCold: boolean;
  subFuelDelta: boolean;
  subUndercut: boolean;
  subPitWindow: boolean;
  subRivalDefend: boolean;
  subRivalAttack: boolean;
  subQualyTraffic: boolean;
  subQualyInvalid: boolean;
  subQualyTime: boolean;
  subQualyElim: boolean;
  subSafetyCar: boolean;
  subRedFlag: boolean;
  subRain: boolean;
  subTrackLimits: boolean;
  subPenalties: boolean;

  setSmartDiscretionEnabled: (enabled: boolean) => void;
  setChatterCooldownSeconds: (sec: number) => void;

  setTyreAlertsEnabled: (enabled: boolean) => void;
  setThermalAlertsEnabled: (enabled: boolean) => void;
  setDamageAlertsEnabled: (enabled: boolean) => void;
  setErsAlertsEnabled: (enabled: boolean) => void;
  setBrakesAlertsEnabled: (enabled: boolean) => void;
  setFuelAlertsEnabled: (enabled: boolean) => void;
  setRivalAlertsEnabled: (enabled: boolean) => void;
  setPitWindowAlertsEnabled: (enabled: boolean) => void;
  setTrackAlertsEnabled: (enabled: boolean) => void;
  setQualyAlertsEnabled: (enabled: boolean) => void;
  setFlagsPensAlertsEnabled: (enabled: boolean) => void;

  setSubTyreWear: (enabled: boolean) => void;
  setSubTyrePuncture: (enabled: boolean) => void;
  setSubTyreThermal: (enabled: boolean) => void;
  setSubTyreCold: (enabled: boolean) => void;
  setSubDamageWing: (enabled: boolean) => void;
  setSubDamageFloor: (enabled: boolean) => void;
  setSubDamageEngine: (enabled: boolean) => void;
  setSubDamageFaults: (enabled: boolean) => void;
  setSubErsLow: (enabled: boolean) => void;
  setSubEngineTemp: (enabled: boolean) => void;
  setSubBrakeTemp: (enabled: boolean) => void;
  setSubBrakeCold: (enabled: boolean) => void;
  setSubFuelDelta: (enabled: boolean) => void;
  setSubUndercut: (enabled: boolean) => void;
  setSubPitWindow: (enabled: boolean) => void;
  setSubRivalDefend: (enabled: boolean) => void;
  setSubRivalAttack: (enabled: boolean) => void;
  setSubQualyTraffic: (enabled: boolean) => void;
  setSubQualyInvalid: (enabled: boolean) => void;
  setSubQualyTime: (enabled: boolean) => void;
  setSubQualyElim: (enabled: boolean) => void;
  setSubSafetyCar: (enabled: boolean) => void;
  setSubRedFlag: (enabled: boolean) => void;
  setSubRain: (enabled: boolean) => void;
  setSubTrackLimits: (enabled: boolean) => void;
  setSubPenalties: (enabled: boolean) => void;
}

export function getInitialTacticalSettings(): Omit<
  TacticalSettingsSlice,
  | 'setSmartDiscretionEnabled'
  | 'setChatterCooldownSeconds'
  | 'setTyreAlertsEnabled'
  | 'setThermalAlertsEnabled'
  | 'setDamageAlertsEnabled'
  | 'setErsAlertsEnabled'
  | 'setBrakesAlertsEnabled'
  | 'setFuelAlertsEnabled'
  | 'setRivalAlertsEnabled'
  | 'setPitWindowAlertsEnabled'
  | 'setTrackAlertsEnabled'
  | 'setQualyAlertsEnabled'
  | 'setFlagsPensAlertsEnabled'
  | 'setSubTyreWear'
  | 'setSubTyrePuncture'
  | 'setSubTyreThermal'
  | 'setSubTyreCold'
  | 'setSubDamageWing'
  | 'setSubDamageFloor'
  | 'setSubDamageEngine'
  | 'setSubDamageFaults'
  | 'setSubErsLow'
  | 'setSubEngineTemp'
  | 'setSubBrakeTemp'
  | 'setSubBrakeCold'
  | 'setSubFuelDelta'
  | 'setSubUndercut'
  | 'setSubPitWindow'
  | 'setSubRivalDefend'
  | 'setSubRivalAttack'
  | 'setSubQualyTraffic'
  | 'setSubQualyInvalid'
  | 'setSubQualyTime'
  | 'setSubQualyElim'
  | 'setSubSafetyCar'
  | 'setSubRedFlag'
  | 'setSubRain'
  | 'setSubTrackLimits'
  | 'setSubPenalties'
> {
  return {
    smartDiscretionEnabled: true,
    chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL,

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
}

export const createTacticalSettingsSlice: StateCreator<
  RadioSettingsState,
  [],
  [],
  TacticalSettingsSlice
> = (set, get) => {
  const createBoolAction =
    (field: keyof TacticalSettingsSlice, triggersCustom = false) =>
    (val: boolean) => {
      set((state) => {
        const nextState = {
          ...state,
          [field]: val,
          ...(triggersCustom
            ? { triggerPreset: RADIO_TRIGGER_PRESETS.CUSTOM }
            : {}),
        };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState),
        };
      });
      get().syncConfigToBackend();
    };

  return {
    ...getInitialTacticalSettings(),

    setSmartDiscretionEnabled: (val) => {
      set((state) => {
        const nextState = { ...state, smartDiscretionEnabled: val };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState),
        };
      });
      get().syncConfigToBackend();
    },
    setChatterCooldownSeconds: (sec) => {
      set((state) => {
        const nextState = { ...state, chatterCooldownSeconds: sec };
        return {
          ...nextState,
          aiConfig: buildAIConfigFromValues(nextState),
        };
      });
      get().syncConfigToBackend();
    },

    setTyreAlertsEnabled: createBoolAction('tyreAlertsEnabled'),
    setThermalAlertsEnabled: createBoolAction('thermalAlertsEnabled'),
    setDamageAlertsEnabled: createBoolAction('damageAlertsEnabled'),
    setErsAlertsEnabled: createBoolAction('ersAlertsEnabled'),
    setBrakesAlertsEnabled: createBoolAction('brakesAlertsEnabled'),
    setFuelAlertsEnabled: createBoolAction('fuelAlertsEnabled'),
    setRivalAlertsEnabled: createBoolAction('rivalAlertsEnabled'),
    setPitWindowAlertsEnabled: createBoolAction('pitWindowAlertsEnabled'),
    setTrackAlertsEnabled: createBoolAction('trackAlertsEnabled'),
    setQualyAlertsEnabled: createBoolAction('qualyAlertsEnabled'),
    setFlagsPensAlertsEnabled: createBoolAction('flagsPensAlertsEnabled'),

    setSubTyreWear: createBoolAction('subTyreWear', true),
    setSubTyrePuncture: createBoolAction('subTyrePuncture', true),
    setSubTyreThermal: createBoolAction('subTyreThermal', true),
    setSubTyreCold: createBoolAction('subTyreCold', true),
    setSubDamageWing: createBoolAction('subDamageWing', true),
    setSubDamageFloor: createBoolAction('subDamageFloor', true),
    setSubDamageEngine: createBoolAction('subDamageEngine', true),
    setSubDamageFaults: createBoolAction('subDamageFaults', true),
    setSubErsLow: createBoolAction('subErsLow', true),
    setSubEngineTemp: createBoolAction('subEngineTemp', true),
    setSubBrakeTemp: createBoolAction('subBrakeTemp', true),
    setSubBrakeCold: createBoolAction('subBrakeCold', true),
    setSubFuelDelta: createBoolAction('subFuelDelta', true),
    setSubUndercut: createBoolAction('subUndercut', true),
    setSubPitWindow: createBoolAction('subPitWindow', true),
    setSubRivalDefend: createBoolAction('subRivalDefend', true),
    setSubRivalAttack: createBoolAction('subRivalAttack', true),
    setSubQualyTraffic: createBoolAction('subQualyTraffic', true),
    setSubQualyInvalid: createBoolAction('subQualyInvalid', true),
    setSubQualyTime: createBoolAction('subQualyTime', true),
    setSubQualyElim: createBoolAction('subQualyElim', true),
    setSubSafetyCar: createBoolAction('subSafetyCar', true),
    setSubRedFlag: createBoolAction('subRedFlag', true),
    setSubRain: createBoolAction('subRain', true),
    setSubTrackLimits: createBoolAction('subTrackLimits', true),
    setSubPenalties: createBoolAction('subPenalties', true),
  };
};
