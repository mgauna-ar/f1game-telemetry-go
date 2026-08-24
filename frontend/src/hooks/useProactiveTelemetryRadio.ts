import { useEffect, useRef, useCallback } from 'react';
import {
  RADIO_ALERT_CONSTANTS,
  SAFETY_CAR_STATUS,
  PIT_STATUS,
  RADIO_STORAGE_KEYS,
} from '../constants/f1';
import type {
  SessionData,
  LapData,
  CarDamageData,
  CarStatusData,
  CarTelemetryData,
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
  events?: RaceEvent[];
  onTriggerAlert?: (alertContext: string, isCritical: boolean) => Promise<void>;
}

export interface ProactiveAlertSettings {
  tyreAlertsEnabled: boolean;
  thermalAlertsEnabled: boolean;
  rivalAlertsEnabled: boolean;
  pitWindowAlertsEnabled: boolean;
  trackAlertsEnabled: boolean;
  smartDiscretionEnabled: boolean;
  chatterCooldownSeconds: number;
  tyreWearWarningPct: number;
  tyreWearCriticalPct: number;
  rivalGapThresholdSec: number;
  rainHorizonMin: number;
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
    onTriggerAlert,
  } = options;

  // Track triggered states to avoid repeats
  const triggeredWearThresholdsRef = useRef<Set<number>>(new Set());
  const lastStintLapAgeRef = useRef<number>(0);
  const lastSafetyCarStatusRef = useRef<number>(SAFETY_CAR_STATUS.CLEAR);
  const lastRedFlagCountRef = useRef<number>(0);
  const lastCooldownTimestampRef = useRef<number>(0);
  const lastRivalAlertTimestampRef = useRef<number>(0);
  const lastThermalAlertTimestampRef = useRef<number>(0);
  const lastUndercutRivalIndexRef = useRef<number>(-1);
  const lastPuncturedRef = useRef<boolean>(false);
  const lastRainAlertRef = useRef<boolean>(false);

  // Settings from localStorage
  const getAlertSettings = useCallback((): ProactiveAlertSettings => {
    if (typeof window === 'undefined') {
      return {
        tyreAlertsEnabled: true,
        thermalAlertsEnabled: true,
        rivalAlertsEnabled: true,
        pitWindowAlertsEnabled: true,
        trackAlertsEnabled: true,
        smartDiscretionEnabled: true,
        chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL,
        tyreWearWarningPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT,
        tyreWearCriticalPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT,
        rivalGapThresholdSec: RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC,
        rainHorizonMin: RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_HORIZON_MIN,
      };
    }
    try {
      const tyre = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TYRE);
      const thermal = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_THERMAL);
      const rival = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL);
      const pitWindow = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_PIT_WINDOW);
      const track = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TRACK);
      const discretion = localStorage.getItem(RADIO_STORAGE_KEYS.SMART_DISCRETION_ENABLED);
      const chatter = localStorage.getItem(RADIO_STORAGE_KEYS.CHATTER_COOLDOWN_SEC);
      const wearWarn = localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_WEAR_WARN_PCT);
      const wearCrit = localStorage.getItem(RADIO_STORAGE_KEYS.TYRE_WEAR_CRIT_PCT);
      const rivalGap = localStorage.getItem(RADIO_STORAGE_KEYS.RIVAL_GAP_THRESHOLD_SEC);
      const rainHoriz = localStorage.getItem(RADIO_STORAGE_KEYS.RAIN_HORIZON_MIN);

      return {
        tyreAlertsEnabled: tyre !== null ? tyre === 'true' : true,
        thermalAlertsEnabled: thermal !== null ? thermal === 'true' : true,
        rivalAlertsEnabled: rival !== null ? rival === 'true' : true,
        pitWindowAlertsEnabled: pitWindow !== null ? pitWindow === 'true' : true,
        trackAlertsEnabled: track !== null ? track === 'true' : true,
        smartDiscretionEnabled: discretion !== null ? discretion === 'true' : true,
        chatterCooldownSeconds: chatter ? parseInt(chatter, 10) || 45 : 45,
        tyreWearWarningPct: wearWarn ? parseInt(wearWarn, 10) || 40 : 40,
        tyreWearCriticalPct: wearCrit ? parseInt(wearCrit, 10) || 75 : 75,
        rivalGapThresholdSec: rivalGap ? parseFloat(rivalGap) || 1.0 : 1.0,
        rainHorizonMin: rainHoriz ? parseInt(rainHoriz, 10) || 5 : 5,
      };
    } catch {
      return {
        tyreAlertsEnabled: true,
        thermalAlertsEnabled: true,
        rivalAlertsEnabled: true,
        pitWindowAlertsEnabled: true,
        trackAlertsEnabled: true,
        smartDiscretionEnabled: true,
        chatterCooldownSeconds: RADIO_ALERT_CONSTANTS.CHATTER_PRESETS.NORMAL,
        tyreWearWarningPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_WARN_PCT,
        tyreWearCriticalPct: RADIO_ALERT_CONSTANTS.DEFAULT_TYRE_CRIT_PCT,
        rivalGapThresholdSec: RADIO_ALERT_CONSTANTS.DEFAULT_RIVAL_GAP_SEC,
        rainHorizonMin: RADIO_ALERT_CONSTANTS.DEFAULT_RAIN_HORIZON_MIN,
      };
    }
  }, []);

  const triggerAlertSafe = useCallback(
    async (contextPrompt: string, isCritical: boolean) => {
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
        const timeSinceLastAlert = now - lastCooldownTimestampRef.current;
        if (timeSinceLastAlert < cooldownMs) {
          return; // Suppressed by cooldown
        }
      }

      lastCooldownTimestampRef.current = now;
      await onTriggerAlert(contextPrompt, isCritical);
    },
    [enabled, isRadioEnabled, telemetry, getAlertSettings, onTriggerAlert]
  );

  // 1. Monitor Tyre Wear & Stint Resets
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !carDamage || !carStatus) return;
    const settings = getAlertSettings();
    if (!settings.tyreAlertsEnabled) return;

    const currentTyreAge = carStatus.TyresAgeLaps || 0;
    // Reset wear thresholds if car pitted (tyre age went back to 0 or 1)
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

    // Critical Puncture alert
    if (maxWear >= RADIO_ALERT_CONSTANTS.PUNCTURE_THRESHOLD && !lastPuncturedRef.current) {
      lastPuncturedRef.current = true;
      triggerAlertSafe(
        `[PROACTIVE PIT WALL CALL: Critical tyre puncture / tyre failure on car! Wear is at ${Math.round(maxWear)}%. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Order driver to box immediately.]`,
        true
      );
      return;
    }

    // Configurable wear thresholds (Warning % & Critical %)
    const activeThresholds = [settings.tyreWearWarningPct, settings.tyreWearCriticalPct].filter(
      (v, idx, self) => typeof v === 'number' && v > 0 && self.indexOf(v) === idx
    );

    for (const threshold of activeThresholds) {
      if (maxWear >= threshold && !triggeredWearThresholdsRef.current.has(threshold)) {
        triggeredWearThresholdsRef.current.add(threshold);
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Tyre wear reached ${Math.round(maxWear)}% (stint age: ${currentTyreAge} laps). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Provide immediate tyre management directive.]`,
          false
        );
        break;
      }
    }
  }, [enabled, isRadioEnabled, carDamage, carStatus, getAlertSettings, triggerAlertSafe]);

  // 2. Monitor Tyre Thermal Window & Overheating
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !telemetry || !carStatus) return;
    const settings = getAlertSettings();
    if (!settings.thermalAlertsEnabled) return;

    const now = Date.now();
    const cooldownMs = (settings.chatterCooldownSeconds || 45) * 1000;
    if (now - lastThermalAlertTimestampRef.current < cooldownMs) {
      return;
    }

    const surfTemps = telemetry.TyresSurfaceTemperature || [0, 0, 0, 0];
    const maxSurfTemp = Math.max(...surfTemps);
    const rearMaxTemp = Math.max(surfTemps[2] || 0, surfTemps[3] || 0);

    if (rearMaxTemp >= RADIO_ALERT_CONSTANTS.TYRE_TEMP_OVERHEAT_C) {
      lastThermalAlertTimestampRef.current = now;
      triggerAlertSafe(
        `[PROACTIVE PIT WALL CALL: Rear tyre surface temperatures are overheating at ${Math.round(rearMaxTemp)}°C! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to manage traction out of corners to cool the rears.]`,
        false
      );
      return;
    }

    if (maxSurfTemp > 0 && maxSurfTemp <= RADIO_ALERT_CONSTANTS.TYRE_TEMP_COLD_C && (carStatus.TyresAgeLaps || 0) < 2) {
      lastThermalAlertTimestampRef.current = now;
      triggerAlertSafe(
        `[PROACTIVE PIT WALL CALL: Tyre temperatures are cold (${Math.round(maxSurfTemp)}°C). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver to weave and build tyre temperature.]`,
        false
      );
    }
  }, [enabled, isRadioEnabled, telemetry, carStatus, getAlertSettings, triggerAlertSafe]);

  // 3. Monitor Track Conditions (Safety Car, Red Flag, Rain)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !session) return;
    const settings = getAlertSettings();
    if (!settings.trackAlertsEnabled) return;

    // Safety Car / VSC status change
    const scStatus = session.SafetyCarStatus ?? SAFETY_CAR_STATUS.CLEAR;
    if (scStatus !== lastSafetyCarStatusRef.current) {
      lastSafetyCarStatusRef.current = scStatus;

      if (scStatus === SAFETY_CAR_STATUS.FULL) {
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Full Safety Car deployed! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Directly announce Safety Car in pista / on track, maintain delta positive, stand by for pit stop window.]`,
          true
        );
      } else if (scStatus === SAFETY_CAR_STATUS.VIRTUAL) {
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Virtual Safety Car (VSC) deployed! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Directly announce VSC deployed, maintain delta, no overtaking.]`,
          true
        );
      }
    }

    // Red Flag period count change
    const redFlagCount = session.NumRedFlagPeriods || 0;
    if (redFlagCount > lastRedFlagCountRef.current) {
      lastRedFlagCountRef.current = redFlagCount;
      triggerAlertSafe(
        `[PROACTIVE PIT WALL CALL: Red Flag deployed! Session stopped. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Instruct driver to return to pit lane slowly.]`,
        true
      );
    }

    // Rain Forecast check
    if (session.WeatherForecastSamples && session.WeatherForecastSamples.length > 0) {
      const imminentRain = session.WeatherForecastSamples.find(
        (s) =>
          ((s.RainPercentage ?? s.rain_percentage ?? 0) >= RADIO_ALERT_CONSTANTS.RAIN_PROBABILITY_THRESHOLD) &&
          ((s.TimeOffset ?? s.time_offset ?? 0) <= settings.rainHorizonMin)
      );
      if (imminentRain && !lastRainAlertRef.current) {
        lastRainAlertRef.current = true;
        const rainPct = imminentRain.RainPercentage ?? imminentRain.rain_percentage ?? 50;
        const timeOff = imminentRain.TimeOffset ?? imminentRain.time_offset ?? settings.rainHorizonMin;
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Weather radar confirms ${rainPct}% chance of rain in the next ${timeOff} minutes. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver directly on tyre crossover strategy.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, session, getAlertSettings, triggerAlertSafe]);

  // 4. Monitor Rival Battles, Gaps & Pit Stop Window Undercut
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !lap || allLaps.length === 0) return;
    const settings = getAlertSettings();

    const now = Date.now();
    const cooldownMs = (settings.chatterCooldownSeconds || 45) * 1000;
    if (now - lastRivalAlertTimestampRef.current < cooldownMs) {
      return;
    }

    const playerPos = lap.CarPosition;
    if (!playerPos || playerPos <= 0) return;

    // Pit Window & Undercut detection
    if (settings.pitWindowAlertsEnabled) {
      const carBehindIdx = allLaps.findIndex((l) => l && l.CarPosition === playerPos + 1);
      if (carBehindIdx >= 0 && carBehindIdx !== lastUndercutRivalIndexRef.current) {
        const rivalLap = allLaps[carBehindIdx];
        if (rivalLap && rivalLap.PitStatus === PIT_STATUS.PITTING) {
          const distanceDelta = (lap.TotalDistance || 0) - (rivalLap.TotalDistance || 0);
          // If rival was within ~3 seconds (~200m)
          if (distanceDelta > 0 && distanceDelta < 200) {
            lastUndercutRivalIndexRef.current = carBehindIdx;
            lastRivalAlertTimestampRef.current = now;
            triggerAlertSafe(
              `[PROACTIVE PIT WALL CALL: Car behind (P${playerPos + 1}) has pitted for an undercut attempt! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Push now on the in-lap.]`,
              true
            );
            return;
          }
        }
      }
    }

    if (!settings.rivalAlertsEnabled) return;

    // Find car behind (playerPosition + 1)
    const carBehindIndex = allLaps.findIndex((l) => l && l.CarPosition === playerPos + 1);
    const maxGapDistanceMeters = settings.rivalGapThresholdSec * 65; // approx 65m per second at speed

    if (carBehindIndex >= 0) {
      const rivalLap = allLaps[carBehindIndex];
      const rivalStatus = allCarStatus[carBehindIndex];
      const rivalDamage = allCarDamage[carBehindIndex];

      const distanceDelta = (lap.TotalDistance || 0) - (rivalLap.TotalDistance || 0);
      const isDrsZone = distanceDelta > 0 && distanceDelta < maxGapDistanceMeters;

      if (isDrsZone) {
        lastRivalAlertTimestampRef.current = now;

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

        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Car behind is within ${settings.rivalGapThresholdSec.toFixed(1)}s gap (<${Math.round(distanceDelta)}m).${extraContext} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Give driver immediate defensive advice.]`,
          false
        );
        return;
      }
    }

    // Find car ahead (playerPosition - 1)
    const carAheadIndex = allLaps.findIndex((l) => l && l.CarPosition === playerPos - 1);
    if (carAheadIndex >= 0) {
      const aheadLap = allLaps[carAheadIndex];
      const aheadStatus = allCarStatus[carAheadIndex];
      const aheadDamage = allCarDamage[carAheadIndex];

      const distanceDeltaAhead = (aheadLap.TotalDistance || 0) - (lap.TotalDistance || 0);
      const isCatchingAhead = distanceDeltaAhead > 0 && distanceDeltaAhead < maxGapDistanceMeters;

      if (isCatchingAhead) {
        lastRivalAlertTimestampRef.current = now;

        let aheadExtra = '';
        if (aheadStatus && aheadStatus.TyresAgeLaps && carStatus && carStatus.TyresAgeLaps) {
          if (aheadStatus.TyresAgeLaps > carStatus.TyresAgeLaps + 5) {
            aheadExtra += ` Car ahead has significantly older tyres (${aheadStatus.TyresAgeLaps} laps old).`;
          }
        }
        if (aheadDamage) {
          const aheadWing = (aheadDamage.FrontLeftWingDamage || 0) + (aheadDamage.FrontRightWingDamage || 0);
          if (aheadWing > 20) {
            aheadExtra += ` Car ahead has wing damage.`;
          }
        }

        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Closing in on car ahead (P${playerPos - 1}) within ${settings.rivalGapThresholdSec.toFixed(1)}s.${aheadExtra} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to attack.]`,
          false
        );
      }
    }
  }, [
    enabled,
    isRadioEnabled,
    lap,
    allLaps,
    carStatus,
    allCarStatus,
    allCarDamage,
    getAlertSettings,
    triggerAlertSafe,
  ]);
}
