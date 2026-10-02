import type { StateCreator } from 'zustand';
import { RADIO_TRIGGER_PRESETS } from '../../constants/f1';
import type { RadioSettingsState } from '../useRadioSettingsStore';
import { TRIGGER_PRESET_VALUES } from './triggerPresets';

export interface TacticalSettingsSlice {
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;

  // Subsystem master switches
  tyreAlertsEnabled: boolean;
  damageAlertsEnabled: boolean;
  ersAlertsEnabled: boolean;
  brakesAlertsEnabled: boolean;
  fuelAlertsEnabled: boolean;
  rivalAlertsEnabled: boolean;
  pitAlertsEnabled: boolean;
  coachingAlertsEnabled: boolean;
  teammateAlertsEnabled: boolean;
  qualyAlertsEnabled: boolean;
  flagsPensAlertsEnabled: boolean;

  // Sub-alert individual toggles
  subTyreWear: boolean;
  subTyrePuncture: boolean;
  subTyreThermal: boolean;
  subTyreCold: boolean;
  subTyreCondition: boolean;
  subTyreCrossover: boolean;
  subDamageWing: boolean;
  subDamageFloor: boolean;
  subDamageEngine: boolean;
  subDamageFaults: boolean;
  subEngineTemp: boolean;
  subErsLow: boolean;
  subErsClipping: boolean;
  subAeroZones: boolean;
  subBrakeTemp: boolean;
  subBrakeCold: boolean;
  subBrakeBias: boolean;
  subFuelDelta: boolean;
  subFuelMix: boolean;
  subUndercut: boolean;
  subRivalDefend: boolean;
  subRivalAttack: boolean;
  subPitWindow: boolean;
  subPitWindowClose: boolean;
  subPitCleanAir: boolean;
  subTyreSet: boolean;
  subPitLane: boolean;
  subPitEntryReminder: boolean;
  subSectorDelta: boolean;
  subStartProcedure: boolean;
  subInlapCooldown: boolean;
  subTeammateAhead: boolean;
  subTeammatePit: boolean;
  subQualyTraffic: boolean;
  subQualyInvalid: boolean;
  subQualyTime: boolean;
  subQualyElim: boolean;
  subSafetyCar: boolean;
  subRedFlag: boolean;
  subRain: boolean;
  subTrackLimits: boolean;
  subPenalties: boolean;
  subFlags: boolean;
  subRaceEvents: boolean;

  setSmartDiscretionEnabled: (enabled: boolean) => void;
  setChatterCooldownSeconds: (sec: number) => void;

  setTyreAlertsEnabled: (enabled: boolean) => void;
  setDamageAlertsEnabled: (enabled: boolean) => void;
  setErsAlertsEnabled: (enabled: boolean) => void;
  setBrakesAlertsEnabled: (enabled: boolean) => void;
  setFuelAlertsEnabled: (enabled: boolean) => void;
  setRivalAlertsEnabled: (enabled: boolean) => void;
  setPitAlertsEnabled: (enabled: boolean) => void;
  setCoachingAlertsEnabled: (enabled: boolean) => void;
  setTeammateAlertsEnabled: (enabled: boolean) => void;
  setQualyAlertsEnabled: (enabled: boolean) => void;
  setFlagsPensAlertsEnabled: (enabled: boolean) => void;

  setSubTyreWear: (enabled: boolean) => void;
  setSubTyrePuncture: (enabled: boolean) => void;
  setSubTyreThermal: (enabled: boolean) => void;
  setSubTyreCold: (enabled: boolean) => void;
  setSubTyreCondition: (enabled: boolean) => void;
  setSubTyreCrossover: (enabled: boolean) => void;
  setSubDamageWing: (enabled: boolean) => void;
  setSubDamageFloor: (enabled: boolean) => void;
  setSubDamageEngine: (enabled: boolean) => void;
  setSubDamageFaults: (enabled: boolean) => void;
  setSubEngineTemp: (enabled: boolean) => void;
  setSubErsLow: (enabled: boolean) => void;
  setSubErsClipping: (enabled: boolean) => void;
  setSubAeroZones: (enabled: boolean) => void;
  setSubBrakeTemp: (enabled: boolean) => void;
  setSubBrakeCold: (enabled: boolean) => void;
  setSubBrakeBias: (enabled: boolean) => void;
  setSubFuelDelta: (enabled: boolean) => void;
  setSubFuelMix: (enabled: boolean) => void;
  setSubUndercut: (enabled: boolean) => void;
  setSubRivalDefend: (enabled: boolean) => void;
  setSubRivalAttack: (enabled: boolean) => void;
  setSubPitWindow: (enabled: boolean) => void;
  setSubPitWindowClose: (enabled: boolean) => void;
  setSubPitCleanAir: (enabled: boolean) => void;
  setSubTyreSet: (enabled: boolean) => void;
  setSubPitLane: (enabled: boolean) => void;
  setSubPitEntryReminder: (enabled: boolean) => void;
  setSubSectorDelta: (enabled: boolean) => void;
  setSubStartProcedure: (enabled: boolean) => void;
  setSubInlapCooldown: (enabled: boolean) => void;
  setSubTeammateAhead: (enabled: boolean) => void;
  setSubTeammatePit: (enabled: boolean) => void;
  setSubQualyTraffic: (enabled: boolean) => void;
  setSubQualyInvalid: (enabled: boolean) => void;
  setSubQualyTime: (enabled: boolean) => void;
  setSubQualyElim: (enabled: boolean) => void;
  setSubSafetyCar: (enabled: boolean) => void;
  setSubRedFlag: (enabled: boolean) => void;
  setSubRain: (enabled: boolean) => void;
  setSubTrackLimits: (enabled: boolean) => void;
  setSubPenalties: (enabled: boolean) => void;
  setSubFlags: (enabled: boolean) => void;
  setSubRaceEvents: (enabled: boolean) => void;
}

export function getInitialTacticalSettings(): Omit<
  TacticalSettingsSlice,
  | 'setSmartDiscretionEnabled'
  | 'setChatterCooldownSeconds'
  | 'setTyreAlertsEnabled'
  | 'setDamageAlertsEnabled'
  | 'setErsAlertsEnabled'
  | 'setBrakesAlertsEnabled'
  | 'setFuelAlertsEnabled'
  | 'setRivalAlertsEnabled'
  | 'setPitAlertsEnabled'
  | 'setCoachingAlertsEnabled'
  | 'setTeammateAlertsEnabled'
  | 'setQualyAlertsEnabled'
  | 'setFlagsPensAlertsEnabled'
  | 'setSubTyreWear'
  | 'setSubTyrePuncture'
  | 'setSubTyreThermal'
  | 'setSubTyreCold'
  | 'setSubTyreCondition'
  | 'setSubTyreCrossover'
  | 'setSubDamageWing'
  | 'setSubDamageFloor'
  | 'setSubDamageEngine'
  | 'setSubDamageFaults'
  | 'setSubEngineTemp'
  | 'setSubErsLow'
  | 'setSubErsClipping'
  | 'setSubAeroZones'
  | 'setSubBrakeTemp'
  | 'setSubBrakeCold'
  | 'setSubBrakeBias'
  | 'setSubFuelDelta'
  | 'setSubFuelMix'
  | 'setSubUndercut'
  | 'setSubRivalDefend'
  | 'setSubRivalAttack'
  | 'setSubPitWindow'
  | 'setSubPitWindowClose'
  | 'setSubPitCleanAir'
  | 'setSubTyreSet'
  | 'setSubPitLane'
  | 'setSubPitEntryReminder'
  | 'setSubSectorDelta'
  | 'setSubStartProcedure'
  | 'setSubInlapCooldown'
  | 'setSubTeammateAhead'
  | 'setSubTeammatePit'
  | 'setSubQualyTraffic'
  | 'setSubQualyInvalid'
  | 'setSubQualyTime'
  | 'setSubQualyElim'
  | 'setSubSafetyCar'
  | 'setSubRedFlag'
  | 'setSubRain'
  | 'setSubTrackLimits'
  | 'setSubPenalties'
  | 'setSubFlags'
  | 'setSubRaceEvents'
> {
  // First run starts on the Immersive preset so the panel label matches what's enabled.
  return {
    smartDiscretionEnabled: true,
    ...TRIGGER_PRESET_VALUES[RADIO_TRIGGER_PRESETS.IMMERSIVE],
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
      set({
        [field]: val,
        ...(triggersCustom ? { triggerPreset: RADIO_TRIGGER_PRESETS.CUSTOM } : {}),
      });
      get().syncConfigToBackend();
    };

  return {
    ...getInitialTacticalSettings(),

    setSmartDiscretionEnabled: (val) => {
      set({ smartDiscretionEnabled: val });
      get().syncConfigToBackend();
    },
    setChatterCooldownSeconds: (sec) => {
      set({ chatterCooldownSeconds: sec });
      get().syncConfigToBackend();
    },

    setTyreAlertsEnabled: createBoolAction('tyreAlertsEnabled'),
    setDamageAlertsEnabled: createBoolAction('damageAlertsEnabled'),
    setErsAlertsEnabled: createBoolAction('ersAlertsEnabled'),
    setBrakesAlertsEnabled: createBoolAction('brakesAlertsEnabled'),
    setFuelAlertsEnabled: createBoolAction('fuelAlertsEnabled'),
    setRivalAlertsEnabled: createBoolAction('rivalAlertsEnabled'),
    setPitAlertsEnabled: createBoolAction('pitAlertsEnabled'),
    setCoachingAlertsEnabled: createBoolAction('coachingAlertsEnabled'),
    setTeammateAlertsEnabled: createBoolAction('teammateAlertsEnabled'),
    setQualyAlertsEnabled: createBoolAction('qualyAlertsEnabled'),
    setFlagsPensAlertsEnabled: createBoolAction('flagsPensAlertsEnabled'),

    setSubTyreWear: createBoolAction('subTyreWear', true),
    setSubTyrePuncture: createBoolAction('subTyrePuncture', true),
    setSubTyreThermal: createBoolAction('subTyreThermal', true),
    setSubTyreCold: createBoolAction('subTyreCold', true),
    setSubTyreCondition: createBoolAction('subTyreCondition', true),
    setSubTyreCrossover: createBoolAction('subTyreCrossover', true),
    setSubDamageWing: createBoolAction('subDamageWing', true),
    setSubDamageFloor: createBoolAction('subDamageFloor', true),
    setSubDamageEngine: createBoolAction('subDamageEngine', true),
    setSubDamageFaults: createBoolAction('subDamageFaults', true),
    setSubEngineTemp: createBoolAction('subEngineTemp', true),
    setSubErsLow: createBoolAction('subErsLow', true),
    setSubErsClipping: createBoolAction('subErsClipping', true),
    setSubAeroZones: createBoolAction('subAeroZones', true),
    setSubBrakeTemp: createBoolAction('subBrakeTemp', true),
    setSubBrakeCold: createBoolAction('subBrakeCold', true),
    setSubBrakeBias: createBoolAction('subBrakeBias', true),
    setSubFuelDelta: createBoolAction('subFuelDelta', true),
    setSubFuelMix: createBoolAction('subFuelMix', true),
    setSubUndercut: createBoolAction('subUndercut', true),
    setSubRivalDefend: createBoolAction('subRivalDefend', true),
    setSubRivalAttack: createBoolAction('subRivalAttack', true),
    setSubPitWindow: createBoolAction('subPitWindow', true),
    setSubPitWindowClose: createBoolAction('subPitWindowClose', true),
    setSubPitCleanAir: createBoolAction('subPitCleanAir', true),
    setSubTyreSet: createBoolAction('subTyreSet', true),
    setSubPitLane: createBoolAction('subPitLane', true),
    setSubPitEntryReminder: createBoolAction('subPitEntryReminder', true),
    setSubSectorDelta: createBoolAction('subSectorDelta', true),
    setSubStartProcedure: createBoolAction('subStartProcedure', true),
    setSubInlapCooldown: createBoolAction('subInlapCooldown', true),
    setSubTeammateAhead: createBoolAction('subTeammateAhead', true),
    setSubTeammatePit: createBoolAction('subTeammatePit', true),
    setSubQualyTraffic: createBoolAction('subQualyTraffic', true),
    setSubQualyInvalid: createBoolAction('subQualyInvalid', true),
    setSubQualyTime: createBoolAction('subQualyTime', true),
    setSubQualyElim: createBoolAction('subQualyElim', true),
    setSubSafetyCar: createBoolAction('subSafetyCar', true),
    setSubRedFlag: createBoolAction('subRedFlag', true),
    setSubRain: createBoolAction('subRain', true),
    setSubTrackLimits: createBoolAction('subTrackLimits', true),
    setSubPenalties: createBoolAction('subPenalties', true),
    setSubFlags: createBoolAction('subFlags', true),
    setSubRaceEvents: createBoolAction('subRaceEvents', true),
  };
};
