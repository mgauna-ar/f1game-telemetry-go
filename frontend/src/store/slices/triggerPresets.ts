import {
  RADIO_ALERT_CONSTANTS,
  RADIO_TRIGGER_PRESETS,
  type RadioTriggerPreset,
} from '../../constants/f1';

/** Category master switches and per-alert switches shown in the radio settings panel. */
export const ALERT_TOGGLE_KEYS = [
  'tyreAlertsEnabled',
  'thermalAlertsEnabled',
  'damageAlertsEnabled',
  'ersAlertsEnabled',
  'brakesAlertsEnabled',
  'fuelAlertsEnabled',
  'rivalAlertsEnabled',
  'pitWindowAlertsEnabled',
  'qualyAlertsEnabled',
  'flagsPensAlertsEnabled',
  'subTyreWear',
  'subTyrePuncture',
  'subTyreThermal',
  'subTyreCold',
  'subDamageWing',
  'subDamageFloor',
  'subDamageEngine',
  'subDamageFaults',
  'subErsLow',
  'subEngineTemp',
  'subBrakeTemp',
  'subBrakeCold',
  'subFuelDelta',
  'subUndercut',
  'subPitWindow',
  'subRivalDefend',
  'subRivalAttack',
  'subQualyTraffic',
  'subQualyInvalid',
  'subQualyTime',
  'subQualyElim',
  'subSafetyCar',
  'subRedFlag',
  'subRain',
  'subTrackLimits',
  'subPenalties',
] as const;

export type AlertToggleKey = (typeof ALERT_TOGGLE_KEYS)[number];
export type AlertToggles = Record<AlertToggleKey, boolean>;

export interface TriggerPresetValues extends AlertToggles {
  chatterCooldownSeconds: number;
}

type NamedTriggerPreset = Exclude<RadioTriggerPreset, typeof RADIO_TRIGGER_PRESETS.CUSTOM>;

export const TRIGGER_PRESET_VALUES: Record<NamedTriggerPreset, TriggerPresetValues> = {
  [RADIO_TRIGGER_PRESETS.IMMERSIVE]: {
    tyreAlertsEnabled: true,
    thermalAlertsEnabled: true,
    damageAlertsEnabled: true,
    ersAlertsEnabled: true,
    brakesAlertsEnabled: true,
    fuelAlertsEnabled: true,
    rivalAlertsEnabled: true,
    pitWindowAlertsEnabled: true,
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
  },
  [RADIO_TRIGGER_PRESETS.COACHING]: {
    tyreAlertsEnabled: true,
    thermalAlertsEnabled: true,
    damageAlertsEnabled: true,
    ersAlertsEnabled: true,
    brakesAlertsEnabled: true,
    fuelAlertsEnabled: true,
    rivalAlertsEnabled: true,
    pitWindowAlertsEnabled: true,
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
  },
  [RADIO_TRIGGER_PRESETS.MINIMAL]: {
    tyreAlertsEnabled: true,
    thermalAlertsEnabled: false,
    damageAlertsEnabled: true,
    ersAlertsEnabled: false,
    brakesAlertsEnabled: false,
    fuelAlertsEnabled: false,
    rivalAlertsEnabled: false,
    pitWindowAlertsEnabled: false,
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
  },
};

export function isRadioTriggerPreset(value: unknown): value is RadioTriggerPreset {
  return (Object.values(RADIO_TRIGGER_PRESETS) as unknown[]).includes(value);
}

/**
 * Returns the named preset whose switches and chatter cooldown match `state`, or `custom`.
 * Used for settings saved before the preset name was stored.
 */
export function detectTriggerPreset(state: TriggerPresetValues): RadioTriggerPreset {
  for (const [preset, values] of Object.entries(TRIGGER_PRESET_VALUES) as [
    NamedTriggerPreset,
    TriggerPresetValues,
  ][]) {
    const matches =
      values.chatterCooldownSeconds === state.chatterCooldownSeconds &&
      ALERT_TOGGLE_KEYS.every((key) => values[key] === state[key]);
    if (matches) return preset;
  }
  return RADIO_TRIGGER_PRESETS.CUSTOM;
}
