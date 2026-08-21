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
      expect.stringContaining('puncture or severe tyre failure'),
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
      expect.stringContaining('DRS range'),
      false
    );
    expect(onTriggerAlert).toHaveBeenCalledWith(
      expect.stringContaining('front wing damage'),
      false
    );
  });
});
