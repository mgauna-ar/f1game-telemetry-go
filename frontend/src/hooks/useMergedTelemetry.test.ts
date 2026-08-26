import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMergedTelemetry } from './useMergedTelemetry';
import type { Lap } from '../types/session';
import type { ComparatorResponse } from '../types/comparator';

describe('useMergedTelemetry Hook', () => {
  const mockResponse: ComparatorResponse = {
    points: [
      { lap_distance: 0, time_delta: 0, timeA: 0, timeB: 0, speedA: 200, speedB: 195, speed_delta: 5, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 4, gearB: 4, ersBatteryA: 90, ersBatteryB: 90, ersDeployModeA: 1, ersDeployModeB: 1 },
      { lap_distance: 100, time_delta: -0.1, timeA: 11.5, timeB: 11.6, speedA: 250, speedB: 245, speed_delta: 5, throttleA: 1, throttleB: 1, brakeA: 0, brakeB: 0, steerA: 0, steerB: 0, gearA: 5, gearB: 5, ersBatteryA: 85, ersBatteryB: 85, ersDeployModeA: 1, ersDeployModeB: 1 },
      { lap_distance: 200, time_delta: -0.2, timeA: 23.0, timeB: 23.2, speedA: 100, speedB: 110, speed_delta: -10, throttleA: 0, throttleB: 0, brakeA: 1, brakeB: 1, steerA: 0, steerB: 0, gearA: 2, gearB: 2, ersBatteryA: 80, ersBatteryB: 80, ersDeployModeA: 1, ersDeployModeB: 1 },
    ],
    turns: [
      { turnNumber: 1, name: 'T1', distance: 150, entryDistance: 115, exitDistance: 185, worldX: 100, worldZ: 200, normalX: 0, normalZ: 1 },
    ],
  };

  const mockLapA: Lap = {
    id: 1,
    session_id: 1,
    lap_number: 1,
    lap_time_ms: 85000,
    sector1_ms: 28000,
    sector2_ms: 30000,
    sector3_ms: 27000,
    is_valid: true,
  };

  const mockLapB: Lap = {
    id: 2,
    session_id: 1,
    lap_number: 1,
    lap_time_ms: 85500,
    sector1_ms: 28200,
    sector2_ms: 29900,
    sector3_ms: 27400,
    is_valid: true,
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.startsWith('/api/comparator/merge')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches merged comparison data and calculates deltas correctly', async () => {
    const { result } = renderHook(() =>
      useMergedTelemetry({
        lapAId: 1,
        lapBId: 2,
        lapAObj: mockLapA,
        lapBObj: mockLapB,
      })
    );

    // Delta A - B = 85000 - 85500 = -500 ms (Lap A is faster by 0.5s)
    expect(result.current.totalDeltaMs).toBe(-500);
    expect(result.current.s1Delta).toBe(-200);
    expect(result.current.s2Delta).toBe(100);
    expect(result.current.s3Delta).toBe(-400);

    await waitFor(() => {
      expect(result.current.comparisonData).toHaveLength(3);
    });

    expect(result.current.detectedTurns).toHaveLength(1);
    expect(result.current.detectedTurns[0].name).toBe('T1');
  });

  it('handles mouse move and zoom domain updates', async () => {
    const { result } = renderHook(() =>
      useMergedTelemetry({
        lapAId: 1,
        lapBId: 2,
        lapAObj: mockLapA,
        lapBObj: mockLapB,
      })
    );

    await waitFor(() => {
      expect(result.current.comparisonData).toHaveLength(3);
    });

    expect(result.current.hoverDistance).toBeNull();

    act(() => {
      result.current.handleMouseMove({ activeLabel: 150 });
    });

    expect(result.current.hoverDistance).toBe(150);

    act(() => {
      result.current.setZoomDomain([50, 150]);
    });

    expect(result.current.zoomDomain).toEqual([50, 150]);
  });
});
