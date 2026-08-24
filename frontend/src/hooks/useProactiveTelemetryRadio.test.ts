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
      expect.stringContaining('1.0s gap'),
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

  it('triggers undercut alert when car behind boxes', async () => {
    const onTriggerAlert = vi.fn().mockResolvedValue(undefined);

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
});
