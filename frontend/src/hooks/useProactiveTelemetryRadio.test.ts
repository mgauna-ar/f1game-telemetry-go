import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProactiveTelemetryRadio } from './useProactiveTelemetryRadio';
import { SAFETY_CAR_STATUS } from '../constants/f1';
import type { SessionData, LapData, CarDamageData, CarStatusData } from '../types/telemetry';

describe('useProactiveTelemetryRadio hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('triggers tyre wear alert when wear crosses threshold 40%', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carDamage = {
      TyresWear: [42, 38, 30, 29],
      BrakesDamage: [0, 0, 0, 0],
    } as unknown as CarDamageData;

    const carStatus = {
      TyresAgeLaps: 12,
      ActualTyreCompound: 16,
    } as unknown as CarStatusData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carDamage,
        carStatus,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Tyre wear reached 42%'),
      false
    );
  });

  it('triggers critical alert on severe puncture (wear >= 95%)', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carDamage = {
      TyresWear: [96, 40, 30, 20],
      BrakesDamage: [0, 0, 0, 0],
    } as unknown as CarDamageData;

    const carStatus = {
      TyresAgeLaps: 22,
      ActualTyreCompound: 16,
    } as unknown as CarStatusData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carDamage,
        carStatus,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('tyre puncture / tyre failure'),
      true
    );
  });

  it('triggers critical alert on Full Safety Car deployment', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SafetyCarStatus: SAFETY_CAR_STATUS.FULL,
    } as unknown as SessionData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Full Safety Car deployed'),
      true
    );
  });

  it('triggers rival DRS alert with compound and damage info', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const playerLap = {
      CarPosition: 3,
      TotalDistance: 5000,
    } as unknown as LapData;

    const rivalLap = {
      CarPosition: 4,
      TotalDistance: 4960, // 40m behind -> within 65m DRS zone
    } as unknown as LapData;

    const playerStatus = {
      ActualTyreCompound: 17, // Medium
      TyresAgeLaps: 15,
    } as unknown as CarStatusData;

    const rivalStatus = {
      ActualTyreCompound: 16, // Soft
      TyresAgeLaps: 3,
    } as unknown as CarStatusData;

    const rivalDamage = {
      FrontLeftWingDamage: 25,
      FrontRightWingDamage: 10,
    } as unknown as CarDamageData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        lap: playerLap,
        allLaps: [playerLap, rivalLap],
        carStatus: playerStatus,
        allCarStatus: [playerStatus, rivalStatus],
        allCarDamage: [{} as any, rivalDamage],
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('DRS threat'),
      false
    );
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('front wing damage'),
      false
    );
  });

  it('suppresses non-critical alerts when Smart Driving Discretion is active during heavy braking', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carDamage = {
      TyresWear: [45, 38, 30, 29],
    } as unknown as CarDamageData;

    const carStatus = {
      TyresAgeLaps: 12,
    } as unknown as CarStatusData;

    const telemetry = {
      Brake: 80, // Heavy braking zone
      Steer: 0.1,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carDamage,
        carStatus,
        telemetry,
        onTriggerAlert,
      })
    );

    // Suppressed because driver is braking hard
    expect(onTriggerAlert).not.toHaveBeenCalled();
  });

  it('triggers rear tyre thermal overheating alert when temps exceed 115°C', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carStatus = {
      TyresAgeLaps: 8,
    } as unknown as CarStatusData;

    const telemetry = {
      TyresSurfaceTemperature: [100, 102, 118, 119], // Overheated rears
      Brake: 0,
      Steer: 0,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carStatus,
        telemetry,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Rear tyre surface temperatures are overheating'),
      false
    );
  });

  it('triggers undercut alert when car behind boxes in a Race session', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 15, // Race
    } as unknown as SessionData;

    const playerLap = {
      CarPosition: 2,
      TotalDistance: 6000,
    } as unknown as LapData;

    const rivalLap = {
      CarPosition: 3,
      TotalDistance: 5920, // 80m behind
      PitStatus: 1, // Pitting!
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        allLaps: [playerLap, rivalLap],
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('undercut attempt'),
      true
    );
  });

  it('suppresses undercut and DRS battle alerts when in a Qualifying session', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 5, // Q1
    } as unknown as SessionData;

    const playerLap = {
      CarPosition: 2,
      TotalDistance: 6000,
    } as unknown as LapData;

    const rivalLap = {
      CarPosition: 3,
      TotalDistance: 5920, // 80m behind
      PitStatus: 1, // Pitting
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        allLaps: [playerLap, rivalLap],
        onTriggerAlert,
      })
    );

    // Should NOT trigger race undercut call during Qualifying
    expect(onTriggerAlert).not.toHaveBeenCalled();
  });

  it('triggers lap invalidation alert when driver exceeds track limits during Qualifying', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 7, // Q3
    } as unknown as SessionData;

    const playerLap = {
      CurrentLapNum: 4,
      CurrentLapInvalid: 1, // Invalidated
      DriverStatus: 1, // Flying lap
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        allLaps: [playerLap],
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('deleted for track limits'),
      true
    );
  });

  it('triggers out-lap traffic alert in Qualifying when car ahead is within 4s in sector 3', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 6, // Q2
      TrackLength: 5891,
    } as unknown as SessionData;

    const playerLap = {
      CurrentLapNum: 2,
      DriverStatus: 3, // Out-lap
      Sector: 2, // Sector 3 (0-indexed 2)
      LapDistance: 4500,
      TotalDistance: 4500,
    } as unknown as LapData;

    const rivalLap = {
      CurrentLapNum: 2,
      TotalDistance: 4620, // 120m ahead (<250m clean air threshold)
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        allLaps: [playerLap, rivalLap],
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Traffic ahead before starting hot lap'),
      true
    );
  });

  it('triggers session time warning when under 3 minutes remain in Qualifying', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 5, // Q1
      SessionTimeLeft: 170, // 2m 50s left (<180s)
    } as unknown as SessionData;

    const playerLap = {
      CurrentLapNum: 5,
      DriverStatus: 0, // In garage
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Under 3 minutes remaining in Qualifying 1 (Q1)'),
      true
    );
  });

  it('triggers elimination danger alert when in Q1 and position is P16 with under 5 min left', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const session = {
      SessionType: 5, // Q1
      SessionTimeLeft: 240, // 4 mins left
    } as unknown as SessionData;

    const playerLap = {
      CarPosition: 16, // Danger zone!
      CurrentLapNum: 3,
    } as unknown as LapData;

    renderHook(() =>
      useProactiveTelemetryRadio({
        session,
        lap: playerLap,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('elimination danger zone with under 5 minutes left'),
      true
    );
  });

  it('triggers front wing damage warning when damage crosses threshold', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carDamage = {
      FrontLeftWingDamage: 25, // 25% damage >= 15% default threshold
      FrontRightWingDamage: 0,
      TyresWear: [0, 0, 0, 0],
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carDamage,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Front wing endplate/flap damage detected (25%)'),
      false
    );
  });

  it('triggers critical emergency alert when front wing damage is severe (>=40%)', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carDamage = {
      FrontLeftWingDamage: 45, // 45% damage >= 40% critical threshold
      FrontRightWingDamage: 0,
      TyresWear: [0, 0, 0, 0],
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carDamage,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Severe front wing damage detected (45% loss)'),
      true
    );
  });

  it('triggers ERS low battery reserve alert when battery drops below threshold', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carStatus = {
      ERSStoreEnergy: 400000, // 400,000 / 4,000,000 = 10% (< 15% default)
      EngineCoolantTemperature: 100,
      TyresAgeLaps: 5,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carStatus,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('ERS battery reserve is low at 10%'),
      false
    );
  });

  it('triggers brake disc overheat alert when brake temps exceed threshold', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const telemetry = {
      BrakesTemperature: [950, 940, 880, 890], // Front brakes > 900°C default
      Brake: 0,
      Steer: 0,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        telemetry,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Brake disc temperatures are critically high at 950°C'),
      false
    );
  });

  it('triggers fuel delta deficit warning and recommends Lift and Coast', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const carStatus = {
      FuelRemainingLaps: -1.2, // -1.2 laps deficit (< -0.6 laps default threshold)
    } as any;

    const lap = {
      CurrentLapNum: 10,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        carStatus,
        lap,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Fuel target delta is negative (-1.2 laps)'),
      false
    );
  });

  it('triggers track limits corner cutting warning before penalty', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    const lap = {
      CornerCuttingWarnings: 2, // 2 warnings >= 2 default threshold
      CurrentLapNum: 8,
      Penalties: 0,
    } as any;

    renderHook(() =>
      useProactiveTelemetryRadio({
        lap,
        onTriggerAlert,
      })
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('Driver has accumulated 2 track limits / corner cutting warnings'),
      true
    );
  });

  it('allows independent per-system alerts without blocking each other by global cooldown', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

    // Initial alert from damage
    const carDamage = {
      FrontLeftWingDamage: 25,
      FrontRightWingDamage: 0,
      TyresWear: [0, 0, 0, 0],
    } as any;

    const { rerender } = renderHook(
      ({ carDamage, carStatus, telemetry }) =>
        useProactiveTelemetryRadio({
          carDamage,
          carStatus,
          telemetry,
          onTriggerAlert,
        }),
      {
        initialProps: {
          carDamage,
          carStatus: undefined,
          telemetry: undefined,
        },
      }
    );

    expect(onTriggerAlert).toHaveBeenCalledTimes(1);

    // Second alert from ERS category immediately afterwards (different subsystem)
    const carStatus = {
      ERSStoreEnergy: 400000, // 10%
      EngineCoolantTemperature: 100,
      TyresAgeLaps: 5,
    } as any;

    rerender({
      carDamage,
      carStatus,
      telemetry: undefined,
    });

    // ERS alert fires because it has its own category cooldown!
    expect(onTriggerAlert).toHaveBeenCalledTimes(2);
  });
});

