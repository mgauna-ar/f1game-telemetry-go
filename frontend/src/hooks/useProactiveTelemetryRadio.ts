import { useEffect, useRef, useCallback } from 'react';
import {
  RADIO_ALERT_CONSTANTS,
  SAFETY_CAR_STATUS,
  PIT_STATUS,
  DRIVER_STATUS,
  SESSION_TYPES,
  RADIO_STORAGE_KEYS,
  isQualifyingSession,
  isPracticeSession,
  isRaceSession,
  getSessionTypeName,
  F1_FORMATS,
} from '../constants/f1';
import type {
  SessionData,
  LapData,
  CarDamageData,
  CarStatusData,
  CarTelemetryData,
  CarTelemetry2Data,
  RaceEvent,
} from '../types/telemetry';

export interface UseProactiveTelemetryRadioOptions {
  enabled?: boolean;
  isRadioEnabled?: boolean;
  playerCarIndex?: number;
  session?: SessionData | null;
  lap?: LapData | null;
  allLaps?: LapData[];
  carDamage?: CarDamageData | null;
  allCarDamage?: CarDamageData[];
  carStatus?: CarStatusData | null;
  allCarStatus?: CarStatusData[];
  telemetry?: CarTelemetryData | null;
  telemetry2?: CarTelemetry2Data | null;
  allTelemetry2?: CarTelemetry2Data[];
  packetFormat?: number | null;
  events?: RaceEvent[];
  onTriggerAlert?: (alertContext: string, isCritical: boolean, emotion?: { rateModifier?: number; pitchModifier?: number }) => Promise<void>;
}

export interface ProactiveAlertSettings {
  // Master switches per subsystem
  tyreAlertsEnabled: boolean;
  damageAlertsEnabled: boolean;
  ersAlertsEnabled: boolean;
  brakesAlertsEnabled: boolean;
  fuelAlertsEnabled: boolean;
  rivalAlertsEnabled: boolean;
  qualyAlertsEnabled: boolean;
  flagsPensAlertsEnabled: boolean;
  pitWindowAlertsEnabled: boolean;
  trackAlertsEnabled: boolean;
  thermalAlertsEnabled: boolean;

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

  // Granular thresholds
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;
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
  qualyTimeWarnSec: number;
  cornerCutWarnThreshold: number;
  rainHorizonMin: number;
  rainProbPct: number;
}

export function useProactiveTelemetryRadio(options: UseProactiveTelemetryRadioOptions = {}) {
  const {
    enabled = true,
    isRadioEnabled = true,
    session,
    lap,
    allLaps = [],
    carDamage,
    allCarDamage = [],
    carStatus,
    allCarStatus = [],
    telemetry,
    telemetry2,
    packetFormat,
    onTriggerAlert,
  } = options;

  const is2026 = packetFormat === F1_FORMATS.FORMAT_2026 || session?.PacketFormat === F1_FORMATS.FORMAT_2026;

  // Track triggered states to avoid repeats
  const triggeredWearThresholdsRef = useRef<Set<number>>(new Set());
  const lastStintLapAgeRef = useRef<number>(0);
  const lastSafetyCarStatusRef = useRef<number>(SAFETY_CAR_STATUS.CLEAR);
  const lastRedFlagCountRef = useRef<number>(0);
  const lastUndercutRivalIndexRef = useRef<number>(-1);
  const lastDrsWarningIndexRef = useRef<number>(-1);
  const lastCarAheadWarningIndexRef = useRef<number>(-1);
  const lastPuncturedRef = useRef<boolean>(false);
  const lastRainAlertRef = useRef<boolean>(false);

  // Damage & Mechanical refs
  const lastWingDamageAlertRef = useRef<number>(0);
  const lastFloorDamageAlertRef = useRef<boolean>(false);
  const lastEngineWearAlertRef = useRef<boolean>(false);
  const lastDrsFaultAlertRef = useRef<boolean>(false);
  const lastErsFaultAlertRef = useRef<boolean>(false);

  // ERS & Thermal refs
  const lastErsLowAlertLapRef = useRef<number>(-1);
  const lastEngineOverheatAlertRef = useRef<number>(0);
  const lastBrakeOverheatAlertRef = useRef<number>(0);
  const lastBrakeColdAlertRef = useRef<number>(0);

  // Fuel & Strategy refs
  const lastFuelDeltaAlertLapRef = useRef<number>(-1);
  const lastPitWindowWarnedLapRef = useRef<number>(-1);

  // Track limits & Penalties refs
  const lastCornerCutWarningsRef = useRef<number>(0);
  const lastPenaltiesCountRef = useRef<number>(0);

  // Qualifying & Session specific refs
  const lastInvalidLapNumRef = useRef<number>(-1);
  const lastOutLapCheckedRef = useRef<number>(-1);
  const lastSessionTimeWarnedRef = useRef<boolean>(false);
  const lastEliminationDangerWarnedRef = useRef<boolean>(false);

  // Independent per-system cooldown timestamps
  const lastCooldownByCategoryRef = useRef<Record<string, number>>({});

  const isQualy = isQualifyingSession(session?.SessionType);
  const isPractice = isPracticeSession(session?.SessionType);
  const isRace = isRaceSession(session?.SessionType) || (!isQualy && !isPractice);

  // Settings from localStorage
  const getAlertSettings = useCallback((): ProactiveAlertSettings => {
    const parseBool = (key: string, def: boolean): boolean => {
      if (typeof window === 'undefined') return def;
      try {
        const val = localStorage.getItem(key);
        return val !== null ? val === 'true' : def;
      } catch {
        return def;
      }
    };

    const parseNum = (key: string, def: number): number => {
      if (typeof window === 'undefined') return def;
      try {
        const val = localStorage.getItem(key);
        if (!val) return def;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? def : parsed;
      } catch {
        return def;
      }
    };

    return {
      // Master subsystem switches
      tyreAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_TYRE, true),
      damageAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_DAMAGE, true),
      ersAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_ERS, true),
      brakesAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_BRAKES, true),
      fuelAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_FUEL, true),
      rivalAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_RIVAL, true),
      qualyAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_QUALY, true),
      flagsPensAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_FLAGS_PENS, true),
      pitWindowAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW, true),
      trackAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_TRACK, true),
      thermalAlertsEnabled: parseBool(RADIO_STORAGE_KEYS.ALERTS_THERMAL, true),

      // Sub-alert individual switches
      subTyreWear: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_WEAR, true),
      subTyrePuncture: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_PUNCTURE, true),
      subTyreThermal: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_THERMAL, true),
      subTyreCold: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_TYRE_COLD, true),
      subDamageWing: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_WING, true),
      subDamageFloor: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FLOOR, true),
      subDamageEngine: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_ENGINE, true),
      subDamageFaults: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_DAMAGE_FAULTS, true),
      subErsLow: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_ERS_LOW, true),
      subEngineTemp: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_ENGINE_TEMP, true),
      subBrakeTemp: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_TEMP, true),
      subBrakeCold: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_BRAKE_COLD, true),
      subFuelDelta: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_FUEL_DELTA, true),
      subUndercut: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_UNDERCUT, true),
      subPitWindow: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_PIT_WINDOW, true),
      subRivalDefend: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_DEFEND, true),
      subRivalAttack: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_RIVAL_ATTACK, true),
      subQualyTraffic: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TRAFFIC, true),
      subQualyInvalid: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_INVALID, true),
      subQualyTime: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_TIME, true),
      subQualyElim: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_QUALY_ELIM, true),
      subSafetyCar: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_SAFETY_CAR, true),
      subRedFlag: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_RED_FLAG, true),
      subRain: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_RAIN, true),
      subTrackLimits: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_TRACK_LIMITS, true),
      subPenalties: parseBool(RADIO_STORAGE_KEYS.SUB_ALERT_PENALTIES, true),

      // Granular thresholds
      smartDiscretionEnabled: parseBool(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED, true),
      chatterCooldownSeconds: parseNum(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC, RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL),
      tyreWearWarningPct: parseNum(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT),
      tyreWearCriticalPct: parseNum(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT),
      tyreOverheatC: parseNum(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_OVERHEAT_C),
      tyreColdC: parseNum(RADIO_STORAGE_KEYS.TYRE_COLD_C, RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_COLD_C),
      wingDamageWarnPct: parseNum(RADIO_STORAGE_KEYS.WING_DAMAGE_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_WING_DAMAGE_WARN_PCT),
      floorDamageWarnPct: parseNum(RADIO_STORAGE_KEYS.FLOOR_DAMAGE_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_FLOOR_DAMAGE_WARN_PCT),
      engineWearWarnPct: parseNum(RADIO_STORAGE_KEYS.ENGINE_WEAR_WARN_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_WEAR_WARN_PCT),
      ersLowPct: parseNum(RADIO_STORAGE_KEYS.ERS_LOW_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_ERS_LOW_PCT),
      engineOverheatC: parseNum(RADIO_STORAGE_KEYS.ENGINE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_ENGINE_OVERHEAT_C),
      brakeOverheatC: parseNum(RADIO_STORAGE_KEYS.BRAKE_OVERHEAT_C, RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_OVERHEAT_C),
      brakeColdC: parseNum(RADIO_STORAGE_KEYS.BRAKE_COLD_C, RADIO_ALERT_CONSTANTS.DEFAULT_BRAKE_COLD_C),
      fuelDeltaLaps: parseNum(RADIO_STORAGE_KEYS.FUEL_DELTA_LAPS, RADIO_ALERT_CONSTANTS.DEFAULT_FUEL_DELTA_LAPS),
      undercutGapSec: parseNum(RADIO_STORAGE_KEYS.UNDERCUT_GAP_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_UNDERCUT_GAP_SEC),
      rivalGapThresholdSec: parseNum(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC),
      rivalAheadGapSec: parseNum(RADIO_STORAGE_KEYS.RIVAL_AHEAD_GAP_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_AHEAD_GAP_SEC),
      qualyCleanAirSec: parseNum(RADIO_STORAGE_KEYS.QUALY_CLEAN_AIR_SEC, RADIO_ALERT_CONSTANTS.DEFAULT_QUALY_CLEAN_AIR_SEC),
      qualyTimeWarnSec: RADIO_ALERT_CONSTANTS.QUALY_SESSION_TIME_WARN_SEC,
      cornerCutWarnThreshold: parseNum(RADIO_STORAGE_KEYS.CORNER_CUT_WARN_THRESHOLD, RADIO_ALERT_CONSTANTS.DEFAULT_CORNER_CUT_WARN_THRESHOLD),
      rainHorizonMin: parseNum(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN, RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_HORIZON_MIN),
      rainProbPct: parseNum(RADIO_STORAGE_KEYS.RAIN_PROB_PCT, RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_PROB_PCT),
    };
  }, []);

  const triggerAlertSafe = useCallback(
    async (
      category: string,
      contextPrompt: string,
      isCritical: boolean,
      emotion?: { rateModifier?: number; pitchModifier?: number }
    ) => {
      if (!enabled || !isRadioEnabled || !onTriggerAlert) return;

      const settings = getAlertSettings();

      // Smart Driving Discretion: Suppress non-critical radio calls while driver is in heavy braking or tight cornering
      if (!isCritical && settings.smartDiscretionEnabled && telemetry) {
        const brakeActive = (telemetry.Brake ?? 0) > RADIO_ALERT_CONSTANTS.SMART_DISCRETION_BRAKE_THRESHOLD;
        const heavySteer = Math.abs(telemetry.Steer ?? 0) > RADIO_ALERT_CONSTANTS.SMART_DISCRETION_STEER_THRESHOLD;
        if (brakeActive || heavySteer) {
          return; // Suppress distracting voice call during corner entry / heavy braking
        }
      }

      const now = Date.now();
      const cooldownMs = (settings.chatterCooldownSeconds || 45) * 1000;
      if (!isCritical) {
        const lastCategoryTimestamp = lastCooldownByCategoryRef.current[category] || 0;
        const timeSinceCategory = now - lastCategoryTimestamp;
        if (timeSinceCategory < cooldownMs) {
          return; // Suppressed by per-system cooldown
        }
      }

      lastCooldownByCategoryRef.current[category] = now;
      if (emotion !== undefined) {
        await onTriggerAlert(contextPrompt, isCritical, emotion);
      } else {
        await onTriggerAlert(contextPrompt, isCritical);
      }
    },
    [enabled, isRadioEnabled, telemetry, getAlertSettings, onTriggerAlert]
  );

  // 1. Monitor Tyre Wear, Punctures, Thermal Overheating & Cold Tyres
  useEffect(() => {
    if (!enabled || !isRadioEnabled) return;
    const settings = getAlertSettings();
    if (!settings.tyreAlertsEnabled) return;

    const currentTyreAge = carStatus?.TyresAgeLaps || 0;

    // 1.1 Tyre Wear & Punctures (Requires carDamage)
    if (carDamage && carStatus) {
      // Reset wear thresholds if car pitted (tyre age reset)
      if (currentTyreAge <= 1 && lastStintLapAgeRef.current > 3) {
        triggeredWearThresholdsRef.current.clear();
        lastPuncturedRef.current = false;
      }
      lastStintLapAgeRef.current = currentTyreAge;

      const wears = [
        carDamage.TyresWear[0] || 0,
        carDamage.TyresWear[1] || 0,
        carDamage.TyresWear[2] || 0,
        carDamage.TyresWear[3] || 0,
      ];
      const maxWear = Math.max(...wears);

      // Critical Puncture alert (Emergency Bypass)
      if (settings.subTyrePuncture && maxWear >= RADIO_ALERT_CONSTANTS.PUNCTURE_THRESHOLD && !lastPuncturedRef.current) {
        lastPuncturedRef.current = true;
        triggerAlertSafe(
          'tyres',
          `[PROACTIVE PIT WALL CALL: Critical tyre puncture / tyre failure on car! Wear is at ${Math.round(maxWear)}%. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Order driver to box immediately.]`,
          true
        );
        return;
      }

      // Configurable wear thresholds
      if (settings.subTyreWear) {
        const activeThresholds = [settings.tyreWearWarningPct, settings.tyreWearCriticalPct].filter(
          (v, idx, self) => typeof v === 'number' && v > 0 && self.indexOf(v) === idx
        );

        for (const threshold of activeThresholds) {
          if (maxWear >= threshold && !triggeredWearThresholdsRef.current.has(threshold)) {
            triggeredWearThresholdsRef.current.add(threshold);
            triggerAlertSafe(
              'tyres',
              `[PROACTIVE PIT WALL CALL: Tyre wear reached ${Math.round(maxWear)}% (stint age: ${currentTyreAge} laps). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Provide immediate tyre management directive.]`,
              false
            );
            break;
          }
        }
      }
    }

    // 1.2 Thermal Surface Window & Cold Tyres (Requires telemetry)
    if (telemetry && (settings.subTyreThermal || settings.subTyreCold)) {
      const surfTemps = telemetry.TyresSurfaceTemperature || [0, 0, 0, 0];
      const maxSurfTemp = Math.max(...surfTemps);
      const rearMaxTemp = Math.max(surfTemps[2] || 0, surfTemps[3] || 0);

      const hasCustomOverheat = typeof window !== 'undefined' && localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_OVERHEAT_C) !== null;
      const effectiveOverheatC = is2026 && !hasCustomOverheat ? 110 : settings.tyreOverheatC;

      if (settings.subTyreThermal && rearMaxTemp >= effectiveOverheatC) {
        const advice = is2026
          ? `Rear tyre surface temperatures are overheating at ${Math.round(rearMaxTemp)}°C (limit: ${effectiveOverheatC}°C)! Manage traction out of corners to protect the narrower rear tyres.`
          : `Rear tyre surface temperatures are overheating at ${Math.round(rearMaxTemp)}°C (limit: ${effectiveOverheatC}°C)! Advise driver to manage traction out of corners to cool the rears.`;
        triggerAlertSafe(
          'tyres',
          `[PROACTIVE PIT WALL CALL: ${advice} You are initiating this call — do NOT say 'Entendido' or 'Copy'.]`,
          false
        );
        return;
      }

      if (settings.subTyreCold && maxSurfTemp > 0 && maxSurfTemp <= settings.tyreColdC && currentTyreAge < 2) {
        triggerAlertSafe(
          'tyres',
          `[PROACTIVE PIT WALL CALL: Tyre temperatures are cold (${Math.round(maxSurfTemp)}°C, target: >${settings.tyreColdC}°C). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to weave and build tyre temperature.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, carDamage, carStatus, telemetry, is2026, getAlertSettings, triggerAlertSafe]);

  // 2. Monitor Aero Damage & Mechanical Components (Front Wing, Floor, Engine Wear, Faults)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !carDamage) return;
    const settings = getAlertSettings();
    if (!settings.damageAlertsEnabled) return;

    // 2.1 Front Wing Damage
    if (settings.subDamageWing) {
      const leftWing = carDamage.FrontLeftWingDamage || 0;
      const rightWing = carDamage.FrontRightWingDamage || 0;
      const maxWing = Math.max(leftWing, rightWing);

      if (maxWing >= RADIO_ALERT_CONSTANTS.CRITICAL_WING_DAMAGE_PCT && lastWingDamageAlertRef.current < RADIO_ALERT_CONSTANTS.CRITICAL_WING_DAMAGE_PCT) {
        lastWingDamageAlertRef.current = maxWing;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: Severe front wing damage detected (${Math.round(maxWing)}% loss)! Massive aero loss on front axle. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Order driver to box for front wing replacement.]`,
          true
        );
        return;
      } else if (maxWing >= settings.wingDamageWarnPct && lastWingDamageAlertRef.current < settings.wingDamageWarnPct) {
        lastWingDamageAlertRef.current = maxWing;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: Front wing endplate/flap damage detected (${Math.round(maxWing)}%). Expect understeer in medium-to-high speed corners. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Adjust brake bias or diff accordingly.]`,
          false
        );
        return;
      }
    }

    // 2.2 Floor & Diffuser Damage
    if (settings.subDamageFloor) {
      const floorDiffDamage = (carDamage.FloorDamage || 0) + (carDamage.DiffuserDamage || 0);
      if (floorDiffDamage >= settings.floorDamageWarnPct && !lastFloorDamageAlertRef.current) {
        lastFloorDamageAlertRef.current = true;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: Underfloor/diffuser aerodynamic damage confirmed (${Math.round(floorDiffDamage)}%). Downforce levels and high-speed stability are compromised. You are initiating this call — do NOT say 'Entendido' or 'Copy'.]`,
          false
        );
        return;
      }
    }

    // 2.3 Internal Engine Component Wear
    if (settings.subDamageEngine) {
      const maxEngineWear = Math.max(
        carDamage.EngineICEWear || 0,
        carDamage.EngineMGUKWear || 0,
        carDamage.EngineTCWear || 0,
        carDamage.GearBoxDamage || 0
      );
      if (maxEngineWear >= settings.engineWearWarnPct && !lastEngineWearAlertRef.current) {
        lastEngineWearAlertRef.current = true;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: Power unit / gearbox component wear reached ${Math.round(maxEngineWear)}%! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to short shift and avoid aggressive kerb riding.]`,
          false
        );
        return;
      }
    }

    // 2.4 DRS / ERS Mechanical Faults
    if (settings.subDamageFaults) {
      if (carDamage.DRSFault === 1 && !lastDrsFaultAlertRef.current) {
        lastDrsFaultAlertRef.current = true;
        const faultMsg = is2026
          ? `Active Aero flap fault detected! Straight mode / aerodynamic wing adjustment unavailable. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Inform driver Active Aero straight mode is currently offline.`
          : `DRS flap fault detected! Rear wing flap cannot deploy. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Inform driver DRS is currently unavailable.`;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: ${faultMsg}]`,
          true
        );
        return;
      }
      if (carDamage.ERSFault === 1 && !lastErsFaultAlertRef.current) {
        lastErsFaultAlertRef.current = true;
        triggerAlertSafe(
          'damage',
          `[PROACTIVE PIT WALL CALL: Hybrid ERS deployment failure detected on power unit! Electric boost offline. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Stand by for system reset protocol.]`,
          true
        );
      }
    }
  }, [enabled, isRadioEnabled, carDamage, is2026, getAlertSettings, triggerAlertSafe]);

  // 3. Monitor ERS Battery Reserve & Engine Core Temperature
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !carStatus) return;
    const settings = getAlertSettings();
    if (!settings.ersAlertsEnabled) return;

    const currentLapNum = lap?.CurrentLapNum || 1;
    const storeEnergy = carStatus.ERSStoreEnergy !== undefined ? carStatus.ERSStoreEnergy : (carStatus as any).ErsStoreEnergy;

    // 3.1 Low ERS Battery Alert
    if (settings.subErsLow && storeEnergy !== undefined) {
      const ersPct = (storeEnergy / RADIO_ALERT_CONSTANTS.MAX_ERS_JOULES) * 100;
      if (ersPct <= settings.ersLowPct && currentLapNum !== lastErsLowAlertLapRef.current && (lap?.DriverStatus === DRIVER_STATUS.FLYING_LAP || isRace)) {
        lastErsLowAlertLapRef.current = currentLapNum;
        const ersMsg = is2026
          ? `ERS battery reserve is low at ${Math.round(ersPct)}%! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to limit Override/Boost usage and use Lift & Coast for MGU-K regeneration on straights.`
          : `ERS battery reserve is low at ${Math.round(ersPct)}%! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to switch deploy mode to None or Harvest on straights.`;
        triggerAlertSafe(
          'ers',
          `[PROACTIVE PIT WALL CALL: ${ersMsg}]`,
          false
        );
      }
    }

    // 3.2 Engine Core Overheating (Radiator / Traffic)
    if (settings.subEngineTemp && telemetry && telemetry.EngineTemperature) {
      const now = Date.now();
      if (telemetry.EngineTemperature >= settings.engineOverheatC && now - lastEngineOverheatAlertRef.current > 60000) {
        lastEngineOverheatAlertRef.current = now;
        triggerAlertSafe(
          'ers',
          `[PROACTIVE PIT WALL CALL: Engine core water/oil temperatures are high at ${Math.round(telemetry.EngineTemperature)}°C (limit: ${settings.engineOverheatC}°C)! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to pull out of dirty air on the straights to cool the power unit.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, carStatus, telemetry, lap, isRace, is2026, getAlertSettings, triggerAlertSafe]);

  // 4. Monitor Braking System & Temperatures
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !telemetry) return;
    const settings = getAlertSettings();
    if (!settings.brakesAlertsEnabled) return;

    const brakeTemps = telemetry.BrakesTemperature || [0, 0, 0, 0];
    const maxBrakeTemp = Math.max(...brakeTemps);
    const now = Date.now();

    // 4.1 Brake Disc Overheating & Fade Warning
    if (settings.subBrakeTemp && maxBrakeTemp >= settings.brakeOverheatC && now - lastBrakeOverheatAlertRef.current > 45000) {
      lastBrakeOverheatAlertRef.current = now;
      triggerAlertSafe(
        'brakes',
        `[PROACTIVE PIT WALL CALL: Brake disc temperatures are critically high at ${Math.round(maxBrakeTemp)}°C (fade threshold: ${settings.brakeOverheatC}°C)! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to manage braking zones and adjust brake bias.]`,
        false
      );
      return;
    }

    // 4.2 Cold Brakes Warning (Formation / SC restart)
    if (settings.subBrakeCold && maxBrakeTemp > 0 && maxBrakeTemp <= settings.brakeColdC && now - lastBrakeColdAlertRef.current > 60000) {
      const isFormationOrSC = (lap?.DriverStatus === DRIVER_STATUS.OUT_LAP) || (session?.SafetyCarStatus !== SAFETY_CAR_STATUS.CLEAR);
      if (isFormationOrSC) {
        lastBrakeColdAlertRef.current = now;
        triggerAlertSafe(
          'brakes',
          `[PROACTIVE PIT WALL CALL: Brake temperatures are cold (${Math.round(maxBrakeTemp)}°C, optimal: >${settings.brakeColdC}°C). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to drag brakes and build temperature before the restart.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, telemetry, lap, session, getAlertSettings, triggerAlertSafe]);

  // 5. Monitor Fuel Delta & Strategy (Lift & Coast, Undercut, Pit Window)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !isRace || !lap) return;
    const settings = getAlertSettings();
    if (!settings.fuelAlertsEnabled) return;

    const playerPos = lap.CarPosition;
    const currentLapNum = lap.CurrentLapNum || 1;

    // 5.1 Undercut Threat Detection (Race only, requires allLaps)
    if (settings.subUndercut && playerPos && playerPos > 0 && allLaps.length > 0) {
      const carBehindIdx = allLaps.findIndex((l) => l && l.CarPosition === playerPos + 1);
      if (carBehindIdx >= 0 && carBehindIdx !== lastUndercutRivalIndexRef.current) {
        const rivalLap = allLaps[carBehindIdx];
        if (rivalLap && rivalLap.PitStatus === PIT_STATUS.PITTING) {
          const distanceDelta = (lap.TotalDistance || 0) - (rivalLap.TotalDistance || 0);
          const maxUndercutDist = settings.undercutGapSec * 65;
          if (distanceDelta > 0 && distanceDelta < maxUndercutDist) {
            lastUndercutRivalIndexRef.current = carBehindIdx;
            triggerAlertSafe(
              'fuel',
              `[PROACTIVE PIT WALL CALL: Car behind (P${playerPos + 1}) has just pitted for an undercut attempt! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Push hard now on the in-lap to defend track position.]`,
              true
            );
            return;
          }
        }
      }
    }

    // 5.2 Pit Stop Window Opening
    if (settings.subPitWindow && session && session.PitStopWindowIdealLap && session.PitStopWindowIdealLap === currentLapNum && lastPitWindowWarnedLapRef.current !== currentLapNum) {
      lastPitWindowWarnedLapRef.current = currentLapNum;
      triggerAlertSafe(
        'fuel',
        `[PROACTIVE PIT WALL CALL: Pit stop window is now open (Lap ${currentLapNum}). Target rejoin position P${session.PitStopRejoinPosition || playerPos || 1}. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Stand by for box call.]`,
        false
      );
      return;
    }

    // 5.3 Fuel Target Deficit & Lift & Coast (Race only)
    if (settings.subFuelDelta && carStatus && typeof carStatus.FuelRemainingLaps === 'number' && currentLapNum > 3) {
      const fuelDelta = carStatus.FuelRemainingLaps;
      if (fuelDelta <= settings.fuelDeltaLaps && lastFuelDeltaAlertLapRef.current !== currentLapNum) {
        lastFuelDeltaAlertLapRef.current = currentLapNum;
        triggerAlertSafe(
          'fuel',
          `[PROACTIVE PIT WALL CALL: Fuel target delta is negative (${fuelDelta.toFixed(1)} laps). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to introduce Lift & Coast into Turn 1 and heavy braking zones.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, isRace, lap, allLaps, carStatus, session, getAlertSettings, triggerAlertSafe]);

  // 6. Monitor Rival Battles, DRS & Gaps (Race only)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !isRace || !lap || allLaps.length === 0) return;
    const settings = getAlertSettings();
    if (!settings.rivalAlertsEnabled) return;

    const playerPos = lap.CarPosition;
    if (!playerPos || playerPos <= 0) return;

    // 6.1 Find car behind (playerPosition + 1)
    if (settings.subRivalDefend) {
      const carBehindIndex = allLaps.findIndex((l) => l && l.CarPosition === playerPos + 1);
      const maxGapDistanceMeters = settings.rivalGapThresholdSec * 65;

      if (carBehindIndex >= 0) {
        const rivalLap = allLaps[carBehindIndex];
        const rivalStatus = allCarStatus[carBehindIndex];
        const rivalDamage = allCarDamage[carBehindIndex];

        const distanceDelta = (lap.TotalDistance || 0) - (rivalLap.TotalDistance || 0);
        const isDrsZone = distanceDelta > 0 && distanceDelta < maxGapDistanceMeters;

        if (isDrsZone) {
          let extraContext = '';
          if (rivalStatus) {
            const rivalCompound = rivalStatus.ActualTyreCompound;
            const playerCompound = carStatus?.ActualTyreCompound;
            if (rivalCompound && playerCompound && rivalCompound !== playerCompound) {
              extraContext += ` Rival is on different compound (Compound ID: ${rivalCompound}, tyre age: ${rivalStatus.TyresAgeLaps} laps).`;
            }
          }
          if (rivalDamage) {
            const rivalWingDamage = (rivalDamage.FrontLeftWingDamage || 0) + (rivalDamage.FrontRightWingDamage || 0);
            if (rivalWingDamage > 20) {
              extraContext += ` Note: Car behind has front wing damage.`;
            }
          }

          if (lastDrsWarningIndexRef.current !== carBehindIndex) {
            lastDrsWarningIndexRef.current = carBehindIndex;
            const gapSec = (distanceDelta / 65).toFixed(1);
            const defendMsg = is2026
              ? `Defend! Car behind (P${playerPos + 1}) is within Override/Boost attack threat (${gapSec}s gap).${extraContext} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to defend line on straight/braking and prepare defense.`
              : `Defend! Car behind (P${playerPos + 1}) is within DRS threat (${gapSec}s gap).${extraContext} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to defend line on straight/braking.`;
            triggerAlertSafe(
              'rivals',
              `[PROACTIVE PIT WALL CALL: ${defendMsg}]`,
              false
            );
            return;
          }
        }
      }
    }

    // 6.2 Find car ahead (playerPosition - 1)
    if (settings.subRivalAttack && playerPos > 1) {
      const carAheadIndex = allLaps.findIndex((l) => l && l.CarPosition === playerPos - 1);
      const maxAttackDistanceMeters = settings.rivalAheadGapSec * 65;

      if (carAheadIndex >= 0 && carAheadIndex !== lastCarAheadWarningIndexRef.current) {
        const rivalLap = allLaps[carAheadIndex];
        const rivalStatus = allCarStatus[carAheadIndex];
        const distanceDelta = (rivalLap.TotalDistance || 0) - (lap.TotalDistance || 0);

        if (distanceDelta > 0 && distanceDelta < maxAttackDistanceMeters) {
          lastCarAheadWarningIndexRef.current = carAheadIndex;
          let tyreContext = '';
          if (rivalStatus) {
            tyreContext = ` Car ahead tyre age: ${rivalStatus.TyresAgeLaps} laps (Compound: ${rivalStatus.ActualTyreCompound}).`;
          }
          const gapSec = (distanceDelta / 65).toFixed(1);
          const overtakeBoostAvailable = telemetry2?.OvertakeAvailable === 1;
          const attackMsg = is2026
            ? `We are catching car ahead (P${playerPos - 1}), gap is ${gapSec}s.${tyreContext}${overtakeBoostAvailable ? ' Override Boost is available!' : ''} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to prepare overtake using Straight Mode and Boost deployment.`
            : `We are catching car ahead (P${playerPos - 1}), gap is ${gapSec}s.${tyreContext} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to prepare overtake / deployment.`;
          triggerAlertSafe(
            'rivals',
            `[PROACTIVE PIT WALL CALL: ${attackMsg}]`,
            false
          );
        }
      }
    }
  }, [enabled, isRadioEnabled, isRace, lap, allLaps, allCarStatus, allCarDamage, carStatus, telemetry2, is2026, getAlertSettings, triggerAlertSafe]);

  // 7. Qualifying & Practice Suite: Lap Invalidation, Out-Lap Clean Air Traffic, Session Clock & Elimination Risk
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !lap) return;
    const settings = getAlertSettings();
    if (!settings.qualyAlertsEnabled) return;

    // 7.1 Lap Invalidation Alert (Qualifying & Practice & Race)
    if (settings.subQualyInvalid && lap.CurrentLapInvalid === 1 && lap.CurrentLapNum !== lastInvalidLapNumRef.current) {
      lastInvalidLapNumRef.current = lap.CurrentLapNum;
      const isPushing = lap.DriverStatus === DRIVER_STATUS.FLYING_LAP || isQualy;
      if (isPushing) {
        triggerAlertSafe(
          'qualy',
          `[PROACTIVE PIT WALL CALL: Lap ${lap.CurrentLapNum} deleted for track limits! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Inform driver lap is invalid, recharge ERS and reset for next flying attempt.]`,
          true
        );
        return;
      }
    }

    // 7.2 Qualifying Out-Lap Clean Air & Traffic Detection
    if (settings.subQualyTraffic && isQualy && lap.DriverStatus === DRIVER_STATUS.OUT_LAP && allLaps.length > 0) {
      const isFinalSector = (lap.Sector ?? 0) >= 2 || (session?.TrackLength && (lap.LapDistance || 0) > session.TrackLength * 0.7);
      if (isFinalSector && lastOutLapCheckedRef.current !== lap.CurrentLapNum) {
        const playerTrackDist = lap.TotalDistance || 0;
        let minAheadDelta = 99999;

        for (const rival of allLaps) {
          if (!rival || rival === lap || !rival.TotalDistance) continue;
          const deltaDist = rival.TotalDistance - playerTrackDist;
          if (deltaDist > 10 && deltaDist < minAheadDelta) {
            minAheadDelta = deltaDist;
          }
        }

        const maxCleanAirDist = settings.qualyCleanAirSec * 60;
        if (minAheadDelta < maxCleanAirDist) {
          lastOutLapCheckedRef.current = lap.CurrentLapNum;
          const gapEstSec = (minAheadDelta / 60).toFixed(1);
          triggerAlertSafe(
            'qualy',
            `[PROACTIVE PIT WALL CALL: Traffic ahead before starting hot lap — car ahead is only ~${gapEstSec}s away (<${Math.round(minAheadDelta)}m). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to slow down in final sector to build at least 4-5s of clean air.]`,
            true
          );
          return;
        } else if (minAheadDelta >= maxCleanAirDist && minAheadDelta < 9000) {
          lastOutLapCheckedRef.current = lap.CurrentLapNum;
          triggerAlertSafe(
            'qualy',
            `[PROACTIVE PIT WALL CALL: Track is clear ahead with clean air gap. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Instruct driver to prepare front tyres and launch out of the final turn.]`,
            false
          );
          return;
        }
      }
    }

    // 7.3 Qualifying / Practice Session Clock Final Run Warning
    if (settings.subQualyTime && (isQualy || isPractice) && session && session.SessionTimeLeft > 0) {
      if (session.SessionTimeLeft <= settings.qualyTimeWarnSec && !lastSessionTimeWarnedRef.current) {
        lastSessionTimeWarnedRef.current = true;
        const sessionName = getSessionTypeName(session.SessionType);
        triggerAlertSafe(
          'qualy',
          `[PROACTIVE PIT WALL CALL: Under ${Math.round(settings.qualyTimeWarnSec / 60)} minutes remaining in ${sessionName}! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to leave pit lane now for final flying lap before the chequered flag.]`,
          true
        );
        return;
      }
    }

    // 7.4 Qualifying Elimination Danger Warning
    if (settings.subQualyElim && isQualy && session && session.SessionTimeLeft > 0 && session.SessionTimeLeft <= 300 && !lastEliminationDangerWarnedRef.current) {
      const playerPos = lap.CarPosition;
      const isQ1Danger = (session.SessionType === SESSION_TYPES.Q1 || session.SessionType === SESSION_TYPES.SPRINT_Q1) && playerPos >= 15;
      const isQ2Danger = (session.SessionType === SESSION_TYPES.Q2 || session.SessionType === SESSION_TYPES.SPRINT_Q2) && playerPos >= 10;

      if (isQ1Danger || isQ2Danger) {
        lastEliminationDangerWarnedRef.current = true;
        triggerAlertSafe(
          'qualy',
          `[PROACTIVE PIT WALL CALL: We are in P${playerPos} in the elimination danger zone with under 5 minutes left! You are initiating this call — do NOT say 'Entendido' or 'Copy'. We need a clean, maximized lap to make the cutoff.]`,
          true
        );
      }
    }
  }, [enabled, isRadioEnabled, lap, allLaps, session, isQualy, isPractice, getAlertSettings, triggerAlertSafe]);

  // 8. Monitor Flags, Safety Car, Rain Radar, Track Limit Warnings & Penalties
  useEffect(() => {
    if (!enabled || !isRadioEnabled) return;
    const settings = getAlertSettings();
    if (!settings.flagsPensAlertsEnabled) return;

    // 8.1 Safety Car / VSC status change (Race only, requires session)
    if (settings.subSafetyCar && isRace && session) {
      const scStatus = session.SafetyCarStatus ?? SAFETY_CAR_STATUS.CLEAR;
      if (scStatus !== lastSafetyCarStatusRef.current) {
        lastSafetyCarStatusRef.current = scStatus;

        if (scStatus === SAFETY_CAR_STATUS.FULL) {
          triggerAlertSafe(
            'flags',
            `[PROACTIVE PIT WALL CALL: Full Safety Car deployed! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Directly announce Safety Car in pista / on track, maintain delta positive, stand by for pit stop window.]`,
            true
          );
        } else if (scStatus === SAFETY_CAR_STATUS.VIRTUAL) {
          triggerAlertSafe(
            'flags',
            `[PROACTIVE PIT WALL CALL: Virtual Safety Car (VSC) deployed! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Directly announce VSC deployed, maintain delta, no overtaking.]`,
            true
          );
        }
      }
    }

    // 8.2 Red Flag period count change (requires session)
    if (settings.subRedFlag && session) {
      const redFlagCount = session.NumRedFlagPeriods || 0;
      if (redFlagCount > lastRedFlagCountRef.current) {
        lastRedFlagCountRef.current = redFlagCount;
        triggerAlertSafe(
          'flags',
          `[PROACTIVE PIT WALL CALL: Red Flag deployed! Session stopped. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Instruct driver to return to pit lane slowly.]`,
          true
        );
      }
    }

    // 8.3 Rain Forecast check (requires session)
    if (settings.subRain && session && session.WeatherForecastSamples && session.WeatherForecastSamples.length > 0) {
      const imminentRain = session.WeatherForecastSamples.find(
        (s) =>
          ((s.RainPercentage ?? s.rain_percentage ?? 0) >= settings.rainProbPct) &&
          ((s.TimeOffset ?? s.time_offset ?? 0) <= settings.rainHorizonMin)
      );
      if (imminentRain && !lastRainAlertRef.current) {
        lastRainAlertRef.current = true;
        const rainPct = imminentRain.RainPercentage ?? imminentRain.rain_percentage ?? 50;
        const timeOff = imminentRain.TimeOffset ?? imminentRain.time_offset ?? settings.rainHorizonMin;
        triggerAlertSafe(
          'flags',
          `[PROACTIVE PIT WALL CALL: Weather radar confirms ${rainPct}% chance of rain in the next ${timeOff} minutes. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver directly on tyre crossover strategy.]`,
          false
        );
      }
    }

    // 8.4 Corner Cutting Warnings Approaching Penalty (Emergency Bypass)
    if (settings.subTrackLimits && lap && typeof lap.CornerCuttingWarnings === 'number') {
      const cutWarnings = lap.CornerCuttingWarnings;
      if (cutWarnings >= settings.cornerCutWarnThreshold && cutWarnings > lastCornerCutWarningsRef.current) {
        lastCornerCutWarningsRef.current = cutWarnings;
        triggerAlertSafe(
          'flags',
          `[PROACTIVE PIT WALL CALL: Driver has accumulated ${cutWarnings} track limits / corner cutting warnings (threshold: 3 warnings -> 3s time penalty)! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Sternly warn driver to keep all four wheels within white lines.]`,
          true
        );
        return;
      }
    }

    // 8.5 Driver Penalties Incurred
    if (settings.subPenalties && lap && typeof lap.Penalties === 'number') {
      const penalties = lap.Penalties;
      if (penalties > 0 && penalties > lastPenaltiesCountRef.current) {
        lastPenaltiesCountRef.current = penalties;
        triggerAlertSafe(
          'flags',
          `[PROACTIVE PIT WALL CALL: Driver has been assessed a ${penalties}-second time penalty by the stewards for track limits / infringement! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Inform driver penalty will be served at the next pit stop.]`,
          true
        );
      }
    }
  }, [enabled, isRadioEnabled, session, lap, isRace, getAlertSettings, triggerAlertSafe]);

  // 9. Monitor Server-Side Telemetry Directives via Dedicated Engineer WebSocket
  const lastDirectiveIdRef = useRef<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const triggerAlertSafeRef = useRef(triggerAlertSafe);
  triggerAlertSafeRef.current = triggerAlertSafe;
  const getAlertSettingsRef = useRef(getAlertSettings);
  getAlertSettingsRef.current = getAlertSettings;

  useEffect(() => {
    // Lazy load: Only connect to /ws/engineer if radio is actually enabled and active
    if (!enabled || !isRadioEnabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const host = window.location.host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${host}/ws/engineer`;
    if (import.meta.env.DEV) {
      wsUrl = `ws://localhost:8080/ws/engineer`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const directive = JSON.parse(event.data) as import('../types/telemetry').EngineerDirective;
        if (!directive || directive.type !== 'directive' || directive.id === lastDirectiveIdRef.current) return;
        
        lastDirectiveIdRef.current = directive.id;

        const settings = getAlertSettingsRef.current();
        let isCategoryEnabled = true;

        if (directive.category === 'pit_strategy' && !settings.pitWindowAlertsEnabled) isCategoryEnabled = false;
        if (directive.category === 'coaching' && !settings.qualyAlertsEnabled) isCategoryEnabled = false;
        if (directive.category === 'weather' && !settings.subRain) isCategoryEnabled = false;
        if (directive.category === 'teammate' && !settings.rivalAlertsEnabled) isCategoryEnabled = false;

        if (!isCategoryEnabled) return;

        const isCritical = directive.urgency === 'critical' || directive.urgency === 'high';
        const emotion = isCritical ? { rateModifier: 12, pitchModifier: 5 } : { rateModifier: 0, pitchModifier: 0 };

        triggerAlertSafeRef.current(
          directive.category,
          `[PROACTIVE PIT WALL CALL: ${directive.title} — ${directive.message} You are initiating this call — do NOT say 'Entendido' or 'Copy'.]`,
          isCritical,
          emotion
        );
      } catch (err) {
        console.error('Failed to parse engineer directive:', err);
      }
    };

    ws.onclose = () => {
      // Allow it to reconnect on next tick if still enabled
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };

    return () => {
      if (wsRef.current === ws) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [enabled, isRadioEnabled]);
}


