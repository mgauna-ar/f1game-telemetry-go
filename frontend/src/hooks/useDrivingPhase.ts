import { useMemo, useRef } from 'react';
import {
  DRIVER_STATUS,
  PIT_STATUS,
  SAFETY_CAR_STATUS,
  RADIO_ALERT_CONSTANTS,
  isRaceSession,
} from '../constants/f1';
import { DrivingPhase } from '../constants/drivingPhaseRules';
import type { SessionData, LapData, CarTelemetryData } from '../types/telemetry';

export interface UseDrivingPhaseOptions {
  session?: SessionData | null;
  lap?: LapData | null;
  telemetry?: CarTelemetryData | null;
}

export interface UseDrivingPhaseResult {
  phase: DrivingPhase;
  previousPhase: DrivingPhase;
  phaseChangedThisTick: boolean;
  lapDistancePct: number;
  isGamePaused: boolean;
  sessionUID: string;
}

export function deriveDrivingPhase(
  session?: SessionData | null,
  lap?: LapData | null,
  telemetry?: CarTelemetryData | null
): DrivingPhase {
  // 1. Red Flag session halt
  if (session && (session.NumRedFlagPeriods || 0) > 0) {
    return DrivingPhase.RED_FLAG;
  }

  // 2. In Garage: explicit DRIVER_STATUS.IN_GARAGE or stationary in pit area
  const speed = telemetry?.Speed ?? 0;
  const isPitArea = lap?.PitStatus === PIT_STATUS.IN_PIT_AREA;
  if (lap?.DriverStatus === DRIVER_STATUS.IN_GARAGE || (isPitArea && speed <= RADIO_ALERT_CONSTANTS.SPEED_GARAGE_MAX_KMH)) {
    return DrivingPhase.IN_GARAGE;
  }

  // 3. Pit Lane: actively pitting or moving in pit area/limiter zone
  const isPitting = lap?.PitStatus === PIT_STATUS.PITTING;
  const isPitLaneTimerActive = lap?.PitLaneTimerActive === 1;
  if (isPitting || isPitArea || isPitLaneTimerActive) {
    return DrivingPhase.PIT_LANE;
  }

  // 4. Formation Lap
  if (session?.SafetyCarStatus === SAFETY_CAR_STATUS.FORMATION_LAP) {
    return DrivingPhase.FORMATION_LAP;
  }

  // 5. Safety Car / VSC
  if (
    session?.SafetyCarStatus === SAFETY_CAR_STATUS.FULL ||
    session?.SafetyCarStatus === SAFETY_CAR_STATUS.VIRTUAL
  ) {
    return DrivingPhase.SAFETY_CAR;
  }

  // 6. Out-Lap
  if (lap?.DriverStatus === DRIVER_STATUS.OUT_LAP) {
    return DrivingPhase.OUT_LAP;
  }

  // 7. In-Lap
  if (lap?.DriverStatus === DRIVER_STATUS.IN_LAP) {
    return DrivingPhase.IN_LAP;
  }

  // 8. Flying Lap
  if (lap?.DriverStatus === DRIVER_STATUS.FLYING_LAP) {
    return DrivingPhase.FLYING_LAP;
  }

  // 9. Racing (default for active on-track sessions or simulated runs)
  if (lap?.DriverStatus === DRIVER_STATUS.ON_TRACK) {
    return DrivingPhase.RACING;
  }

  if (session && isRaceSession(session.SessionType)) {
    return DrivingPhase.RACING;
  }

  return DrivingPhase.RACING;
}

export function useDrivingPhase(options: UseDrivingPhaseOptions = {}): UseDrivingPhaseResult {
  const { session, lap, telemetry } = options;

  const currentPhase = useMemo(() => {
    return deriveDrivingPhase(session, lap, telemetry);
  }, [session, lap, telemetry]);

  const prevPhaseRef = useRef<DrivingPhase>(currentPhase);
  const phaseChangedThisTick = prevPhaseRef.current !== currentPhase;
  const previousPhase = prevPhaseRef.current;

  // Update previous phase ref for next tick
  prevPhaseRef.current = currentPhase;

  // Calculate track distance completion percentage (0.0 to 1.0)
  const lapDistancePct = useMemo(() => {
    if (session?.TrackLength && typeof lap?.LapDistance === 'number' && session.TrackLength > 0) {
      return Math.max(0, Math.min(1, lap.LapDistance / session.TrackLength));
    }
    if (typeof lap?.Sector === 'number') {
      if (lap.Sector === 0) return 0.15;
      if (lap.Sector === 1) return 0.5;
      if (lap.Sector === 2) return 0.85;
    }
    return 0;
  }, [session?.TrackLength, lap?.LapDistance, lap?.Sector]);

  const isGamePaused = Boolean(session?.GamePaused && session.GamePaused === 1);
  const sessionUID = String(session?.SessionUID ?? '');

  return {
    phase: currentPhase,
    previousPhase,
    phaseChangedThisTick,
    lapDistancePct,
    isGamePaused,
    sessionUID,
  };
}
