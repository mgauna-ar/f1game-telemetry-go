import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useLapStaging } from './useLapStaging';
import type { Session, Lap, DriverStanding } from '../types/session';

describe('useLapStaging Hook', () => {
  const mockSession: Session = {
    id: 42,
    session_uid: '0x42',
    created_at: '2026-05-01T10:00:00Z',
    track_name: 'Silverstone',
    session_type: 'Race',
  };

  const mockLap: Lap = {
    id: 100,
    session_id: 42,
    lap_number: 12,
    lap_time_ms: 88500,
    is_valid: true,
    tyre_compound: 'SOFT',
  };

  const mockDriver: DriverStanding = {
    carIndex: 0,
    driverName: 'Lewis Hamilton',
    teamName: 'Mercedes',
    teamId: 1,
    raceNumber: 44,
    position: 1,
    participant: {
      id: 1,
      session_id: 42,
      car_index: 0,
      name: 'Lewis Hamilton',
      driver_id: 1,
      team_id: 1,
      race_number: 44,
      ai_controlled: false,
    },
    laps: [mockLap],
    bestLap: mockLap,
    bestLapTimeMS: 88500,
    lastLap: mockLap,
    lastLapTimeMS: 88500,
    totalRaceTimeMS: 88500,
    penaltySeconds: 0,
    isDNF: false,
    isDSQ: false,
    maxSpeed: 320,
    bestS1MS: 28000,
    bestS2MS: 32000,
    bestS3MS: 28500,
    theoreticalBestMS: 88500,
  };

  it('stages lap into Slot A and Slot B', () => {
    const { result } = renderHook(() => useLapStaging());

    expect(result.current.stagedSlotA).toBeNull();
    expect(result.current.stagedSlotB).toBeNull();

    act(() => {
      result.current.handleStageLap(mockSession, mockLap, mockDriver, 'A');
    });

    expect(result.current.stagedSlotA?.lapId).toBe(100);
    expect(result.current.stagedSlotA?.driverName).toBe('Lewis Hamilton');

    act(() => {
      result.current.handleStageLap(mockSession, mockLap, mockDriver, 'B');
    });

    expect(result.current.stagedSlotB?.lapId).toBe(100);
  });

  it('swaps and clears staged slots', () => {
    const { result } = renderHook(() => useLapStaging());

    act(() => {
      result.current.handleStageLap(mockSession, mockLap, mockDriver, 'A');
    });

    act(() => {
      result.current.handleSwapStagedSlots();
    });

    expect(result.current.stagedSlotA).toBeNull();
    expect(result.current.stagedSlotB?.lapId).toBe(100);

    act(() => {
      result.current.handleClearAllStaged();
    });

    expect(result.current.stagedSlotA).toBeNull();
    expect(result.current.stagedSlotB).toBeNull();
  });

  it('launches comparison with navigation callback', () => {
    const onNavigateToComparator = vi.fn();
    const { result } = renderHook(() => useLapStaging({ onNavigateToComparator }));

    act(() => {
      result.current.handleStageLap(mockSession, mockLap, mockDriver, 'A');
    });

    act(() => {
      result.current.handleLaunchComparison();
    });

    expect(onNavigateToComparator).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionAId: 42,
        lapAId: 100,
      })
    );
  });
});
