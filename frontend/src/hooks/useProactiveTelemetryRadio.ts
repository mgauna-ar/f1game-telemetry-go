import { useEffect, useRef, useCallback } from 'react';
import {
  RADIO_ALERT_CONSTANTS,
  SAFETY_CAR_STATUS,
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
  rivalAlertsEnabled: boolean;
  trackAlertsEnabled: boolean;
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
    onTriggerAlert,
  } = options;

  // Track triggered states to avoid repeats
  const triggeredWearThresholdsRef = useRef<Set<number>>(new Set());
  const lastStintLapAgeRef = useRef<number>(0);
  const lastSafetyCarStatusRef = useRef<number>(SAFETY_CAR_STATUS.CLEAR);
  const lastRedFlagCountRef = useRef<number>(0);
  const lastCooldownTimestampRef = useRef<number>(0);
  const lastRivalAlertTimestampRef = useRef<number>(0);
  const lastPuncturedRef = useRef<boolean>(false);
  const lastRainAlertRef = useRef<boolean>(false);

  // Settings from localStorage
  const getAlertSettings = useCallback((): ProactiveAlertSettings => {
    if (typeof window === 'undefined') {
      return { tyreAlertsEnabled: true, rivalAlertsEnabled: true, trackAlertsEnabled: true };
    }
    try {
      const tyre = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TYRE);
      const rival = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_RIVAL);
      const track = localStorage.getItem(RADIO_STORAGE_KEYS.ALERTS_TRACK);
      return {
        tyreAlertsEnabled: tyre !== null ? tyre === 'true' : true,
        rivalAlertsEnabled: rival !== null ? rival === 'true' : true,
        trackAlertsEnabled: track !== null ? track === 'true' : true,
      };
    } catch {
      return { tyreAlertsEnabled: true, rivalAlertsEnabled: true, trackAlertsEnabled: true };
    }
  }, []);

  const triggerAlertSafe = useCallback(
    async (contextPrompt: string, isCritical: boolean) => {
      if (!enabled || !isRadioEnabled || !onTriggerAlert) return;

      const now = Date.now();
      if (!isCritical) {
        const timeSinceLastAlert = now - lastCooldownTimestampRef.current;
        if (timeSinceLastAlert < RADIO_ALERT_CONSTANTS.COOLDOWN_NON_CRITICAL_MS) {
          return; // Suppressed by cooldown
        }
      }

      lastCooldownTimestampRef.current = now;
      await onTriggerAlert(contextPrompt, isCritical);
    },
    [enabled, isRadioEnabled, onTriggerAlert]
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

    // Wear thresholds (40%, 60%, 75%)
    for (const threshold of RADIO_ALERT_CONSTANTS.TYRE_WEAR_THRESHOLDS) {
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

  // 2. Monitor Track Conditions (Safety Car, Red Flag, Rain)
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
        (s) => ((s.RainPercentage ?? s.rain_percentage ?? 0) >= RADIO_ALERT_CONSTANTS.RAIN_PROBABILITY_THRESHOLD) &&
               ((s.TimeOffset ?? s.time_offset ?? 0) <= 5)
      );
      if (imminentRain && !lastRainAlertRef.current) {
        lastRainAlertRef.current = true;
        const rainPct = imminentRain.RainPercentage ?? imminentRain.rain_percentage ?? 50;
        const timeOff = imminentRain.TimeOffset ?? imminentRain.time_offset ?? 5;
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Weather radar confirms ${rainPct}% chance of rain in the next ${timeOff} minutes. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Advise driver directly on tyre crossover strategy.]`,
          false
        );
      }
    }
  }, [enabled, isRadioEnabled, session, getAlertSettings, triggerAlertSafe]);

  // 3. Monitor Rival & Gaps (Car behind DRS threat, tyre differences, car damage, approaching car ahead)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !lap || allLaps.length === 0) return;
    const settings = getAlertSettings();
    if (!settings.rivalAlertsEnabled) return;

    const now = Date.now();
    if (now - lastRivalAlertTimestampRef.current < RADIO_ALERT_CONSTANTS.COOLDOWN_NON_CRITICAL_MS) {
      return;
    }

    const playerPos = lap.CarPosition;
    if (!playerPos || playerPos <= 0) return;

    // Find car behind (playerPosition + 1)
    const carBehindIndex = allLaps.findIndex((l) => l && l.CarPosition === playerPos + 1);
    if (carBehindIndex >= 0) {
      const rivalLap = allLaps[carBehindIndex];
      const rivalStatus = allCarStatus[carBehindIndex];
      const rivalDamage = allCarDamage[carBehindIndex];

      // Calculate approximate gap in distance or lap times
      const distanceDelta = (lap.TotalDistance || 0) - (rivalLap.TotalDistance || 0);
      const isDrsZone = distanceDelta > 0 && distanceDelta < 65; // ~1.0s gap at racing speed

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
          `[PROACTIVE PIT WALL CALL: Car behind is within DRS range (<1.0s gap).${extraContext} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Give driver immediate defensive advice.]`,
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
      const isCatchingAhead = distanceDeltaAhead > 0 && distanceDeltaAhead < 60;

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
          `[PROACTIVE PIT WALL CALL: Closing in on car ahead (P${playerPos - 1}) in DRS range.${aheadExtra} You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to attack.]`,
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
