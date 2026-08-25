import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrivingPhase, deriveDrivingPhase } from './useDrivingPhase';
import { DrivingPhase } from '../constants/drivingPhaseRules';
import { DRIVER_STATUS, PIT_STATUS, SAFETY_CAR_STATUS, SESSION_TYPES } from '../constants/f1';
import type { SessionData, LapData, CarTelemetryData } from '../types/telemetry';

describe('useDrivingPhase and deriveDrivingPhase', () => {
  it('derives IN_GARAGE when DriverStatus is IN_GARAGE', () => {
    const lap = { DriverStatus: DRIVER_STATUS.IN_GARAGE } as LapData;
    expect(deriveDrivingPhase(null, lap, null)).toBe(DrivingPhase.IN_GARAGE);
  });

  it('derives IN_GARAGE when car is in pit area with speed near 0', () => {
    const lap = { PitStatus: PIT_STATUS.IN_PIT_AREA } as LapData;
    const telemetry = { Speed: 0 } as CarTelemetryData;
    expect(deriveDrivingPhase(null, lap, telemetry)).toBe(DrivingPhase.IN_GARAGE);
  });

  it('derives PIT_LANE when car is moving in pit area or pitting', () => {
    const lap = { PitStatus: PIT_STATUS.PITTING } as LapData;
    const telemetry = { Speed: 60 } as CarTelemetryData;
    expect(deriveDrivingPhase(null, lap, telemetry)).toBe(DrivingPhase.PIT_LANE);

    const lapInPitAreaMoving = { PitStatus: PIT_STATUS.IN_PIT_AREA } as LapData;
    expect(deriveDrivingPhase(null, lapInPitAreaMoving, telemetry)).toBe(DrivingPhase.PIT_LANE);
  });

  it('derives FORMATION_LAP when SafetyCarStatus is FORMATION_LAP', () => {
    const session = { SafetyCarStatus: SAFETY_CAR_STATUS.FORMATION_LAP } as SessionData;
    expect(deriveDrivingPhase(session, null, null)).toBe(DrivingPhase.FORMATION_LAP);
  });

  it('derives SAFETY_CAR when SafetyCarStatus is FULL or VIRTUAL', () => {
    const sessionFull = { SafetyCarStatus: SAFETY_CAR_STATUS.FULL } as SessionData;
    expect(deriveDrivingPhase(sessionFull, null, null)).toBe(DrivingPhase.SAFETY_CAR);

    const sessionVsc = { SafetyCarStatus: SAFETY_CAR_STATUS.VIRTUAL } as SessionData;
    expect(deriveDrivingPhase(sessionVsc, null, null)).toBe(DrivingPhase.SAFETY_CAR);
  });

  it('derives OUT_LAP when DriverStatus is OUT_LAP', () => {
    const lap = { DriverStatus: DRIVER_STATUS.OUT_LAP } as LapData;
    expect(deriveDrivingPhase(null, lap, null)).toBe(DrivingPhase.OUT_LAP);
  });

  it('derives IN_LAP when DriverStatus is IN_LAP', () => {
    const lap = { DriverStatus: DRIVER_STATUS.IN_LAP } as LapData;
    expect(deriveDrivingPhase(null, lap, null)).toBe(DrivingPhase.IN_LAP);
  });

  it('derives FLYING_LAP when DriverStatus is FLYING_LAP', () => {
    const lap = { DriverStatus: DRIVER_STATUS.FLYING_LAP } as LapData;
    expect(deriveDrivingPhase(null, lap, null)).toBe(DrivingPhase.FLYING_LAP);
  });

  it('derives RACING during a race session on track', () => {
    const session = { SessionType: SESSION_TYPES.RACE } as SessionData;
    const lap = { DriverStatus: DRIVER_STATUS.ON_TRACK } as LapData;
    expect(deriveDrivingPhase(session, lap, null)).toBe(DrivingPhase.RACING);
  });

  it('calculates lapDistancePct correctly from TrackLength and LapDistance', () => {
    const session = { TrackLength: 5000 } as SessionData;
    const lap = { LapDistance: 2500 } as LapData;

    const { result } = renderHook(() =>
      useDrivingPhase({ session, lap })
    );

    expect(result.current.lapDistancePct).toBe(0.5);
    expect(result.current.isGamePaused).toBe(false);
  });

  it('detects game paused state', () => {
    const session = { GamePaused: 1 } as SessionData;

    const { result } = renderHook(() =>
      useDrivingPhase({ session })
    );

    expect(result.current.isGamePaused).toBe(true);
  });
});
