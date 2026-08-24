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

  // Qualifying & Session specific refs
  const lastInvalidLapNumRef = useRef<number>(-1);
  const lastOutLapCheckedRef = useRef<number>(-1);
  const lastSessionTimeWarnedRef = useRef<boolean>(false);
  const lastEliminationDangerWarnedRef = useRef<boolean>(false);

  const isQualy = isQualifyingSession(session?.SessionType);
  const isPractice = isPracticeSession(session?.SessionType);
  const isRace = isRaceSession(session?.SessionType) || (!isQualy && !isPractice);

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

    // Safety Car / VSC status change (Race only)
    if (isRace) {
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
    }

    // Red Flag period count change (Active in all sessions)
    const redFlagCount = session.NumRedFlagPeriods || 0;
    if (redFlagCount > lastRedFlagCountRef.current) {
      lastRedFlagCountRef.current = redFlagCount;
      triggerAlertSafe(
        `[PROACTIVE PIT WALL CALL: Red Flag deployed! Session stopped. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Instruct driver to return to pit lane slowly.]`,
        true
      );
    }

    // Rain Forecast check (Active in all sessions)
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
  }, [enabled, isRadioEnabled, session, isRace, getAlertSettings, triggerAlertSafe]);

  // 4. Qualifying & Practice Suite: Lap Invalidation, Out-Lap Clean Air Traffic, Session Clock & Elimination Risk
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !lap) return;

    // 4.1 Lap Invalidation Alert (Qualifying & Practice & Race)
    if (lap.CurrentLapInvalid === 1 && lap.CurrentLapNum !== lastInvalidLapNumRef.current) {
      lastInvalidLapNumRef.current = lap.CurrentLapNum;
      const isPushing = lap.DriverStatus === DRIVER_STATUS.FLYING_LAP || isQualy;
      if (isPushing) {
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Lap ${lap.CurrentLapNum} deleted for track limits! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Inform driver lap is invalid, recharge ERS and reset for next flying attempt.]`,
          true
        );
        return;
      }
    }

    // 4.2 Qualifying Out-Lap Clean Air & Traffic Detection
    if (isQualy && lap.DriverStatus === DRIVER_STATUS.OUT_LAP && allLaps.length > 0) {
      // If driver is in Sector 3 (Sector index 2 or distance nearing end of lap), evaluate traffic ahead
      const isFinalSector = (lap.Sector ?? 0) >= 2 || (session?.TrackLength && (lap.LapDistance || 0) > session.TrackLength * 0.7);
      if (isFinalSector && lastOutLapCheckedRef.current !== lap.CurrentLapNum) {
        // Find car closest ahead on track
        const playerTrackDist = lap.TotalDistance || 0;
        let minAheadDelta = 99999;

        for (const rival of allLaps) {
          if (!rival || rival === lap || !rival.TotalDistance) continue;
          const deltaDist = rival.TotalDistance - playerTrackDist;
          if (deltaDist > 10 && deltaDist < minAheadDelta) {
            minAheadDelta = deltaDist;
          }
        }

        if (minAheadDelta < RADIO_ALERT_CONSTANTS.QUALY_CLEAN_AIR_DISTANCE_METERS) {
          lastOutLapCheckedRef.current = lap.CurrentLapNum;
          const gapEstSec = (minAheadDelta / 60).toFixed(1);
          triggerAlertSafe(
            `[PROACTIVE PIT WALL CALL: Traffic ahead before starting hot lap — car ahead is only ~${gapEstSec}s away (<${Math.round(minAheadDelta)}m). You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to slow down in final sector to build at least 4-5s of clean air.]`,
            true
          );
          return;
        } else if (minAheadDelta >= RADIO_ALERT_CONSTANTS.QUALY_CLEAN_AIR_DISTANCE_METERS && minAheadDelta < 9000) {
          lastOutLapCheckedRef.current = lap.CurrentLapNum;
          triggerAlertSafe(
            `[PROACTIVE PIT WALL CALL: Track is clear ahead with clean air gap. You are initiating this call — do NOT say 'Entendido' or 'Copy'. Instruct driver to prepare front tyres and launch out of the final turn.]`,
            false
          );
          return;
        }
      }
    }

    // 4.3 Qualifying / Practice Session Clock Final Run Warning (Under 3 Minutes)
    if ((isQualy || isPractice) && session && session.SessionTimeLeft > 0) {
      if (session.SessionTimeLeft <= RADIO_ALERT_CONSTANTS.QUALY_SESSION_TIME_WARN_SEC && !lastSessionTimeWarnedRef.current) {
        lastSessionTimeWarnedRef.current = true;
        const sessionName = getSessionTypeName(session.SessionType);
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: Under 3 minutes remaining in ${sessionName}! You are initiating this call — do NOT say 'Entendido' or 'Copy'. Direct driver to leave pit lane now for final flying lap before the chequered flag.]`,
          true
        );
        return;
      }
    }

    // 4.4 Qualifying Elimination Danger Warning (Under 5 Minutes & in Cutoff Zone)
    if (isQualy && session && session.SessionTimeLeft > 0 && session.SessionTimeLeft <= 300 && !lastEliminationDangerWarnedRef.current) {
      const playerPos = lap.CarPosition;
      const isQ1Danger = (session.SessionType === SESSION_TYPES.Q1 || session.SessionType === SESSION_TYPES.SPRINT_Q1) && playerPos >= 15;
      const isQ2Danger = (session.SessionType === SESSION_TYPES.Q2 || session.SessionType === SESSION_TYPES.SPRINT_Q2) && playerPos >= 10;

      if (isQ1Danger || isQ2Danger) {
        lastEliminationDangerWarnedRef.current = true;
        triggerAlertSafe(
          `[PROACTIVE PIT WALL CALL: We are in P${playerPos} in the elimination danger zone with under 5 minutes left! You are initiating this call — do NOT say 'Entendido' or 'Copy'. We need a clean, maximized lap to make the cutoff.]`,
          true
        );
      }
    }
  }, [enabled, isRadioEnabled, lap, allLaps, session, isQualy, isPractice, triggerAlertSafe]);

  // 5. Monitor Rival Battles, Gaps & Pit Stop Window Undercut (Race only)
  useEffect(() => {
    if (!enabled || !isRadioEnabled || !isRace || !lap || allLaps.length === 0) return;
    const settings = getAlertSettings();

    const now = Date.now();
    const cooldownMs = (settings.chatterCooldownSeconds || 45) * 1000;
    if (now - lastRivalAlertTimestampRef.current < cooldownMs) {
      return;
    }

    const playerPos = lap.CarPosition;
    if (!playerPos || playerPos <= 0) return;

    // Pit Window & Undercut detection (Race only)
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
    isRace,
    lap,
    allLaps,
    carStatus,
    allCarStatus,
    allCarDamage,
    getAlertSettings,
    triggerAlertSafe,
  ]);
}

