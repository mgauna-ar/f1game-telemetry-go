import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMergedTelemetry } from './useMergedTelemetry';
import type { TelemetrySamplePoint } from '../utils/downsample';
import type { Lap } from '../types/session';

describe('useMergedTelemetry Hook', () => {
  const mockTelemetryA: TelemetrySamplePoint[] = [
    { lap_distance: 0, session_time: 10.0, speed: 200, throttle: 1, brake: 0, gear: 4, engine_rpm: 10000 },
    { lap_distance: 100, session_time: 11.5, speed: 250, throttle: 1, brake: 0, gear: 5, engine_rpm: 11000 },
    { lap_distance: 200, session_time: 13.0, speed: 100, throttle: 0, brake: 1, gear: 2, engine_rpm: 7000 },
  ];

  const mockTelemetryB: TelemetrySamplePoint[] = [
    { lap_distance: 0, session_time: 20.0, speed: 195, throttle: 1, brake: 0, gear: 4, engine_rpm: 9800 },
    { lap_distance: 100, session_time: 21.6, speed: 245, throttle: 1, brake: 0, gear: 5, engine_rpm: 10800 },
    { lap_distance: 200, session_time: 23.2, speed: 110, throttle: 0, brake: 1, gear: 2, engine_rpm: 7500 },
  ];

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

  it('calculates deltas and merges telemetry samples correctly', () => {
    const { result } = renderHook(() =>
      useMergedTelemetry({
        rawTelemetryA: mockTelemetryA,
        rawTelemetryB: mockTelemetryB,
        lapAObj: mockLapA,
        lapBObj: mockLapB,
      })
    );

    // Delta A - B = 85000 - 85500 = -500 ms (Lap A is faster by 0.5s)
    expect(result.current.totalDeltaMs).toBe(-500);
    expect(result.current.s1Delta).toBe(-200);
    expect(result.current.s2Delta).toBe(100);
    expect(result.current.s3Delta).toBe(-400);

    expect(result.current.comparisonData.length).toBeGreaterThan(0);
  });

  it('handles mouse move and zoom domain updates', () => {
    const { result } = renderHook(() =>
      useMergedTelemetry({
        rawTelemetryA: mockTelemetryA,
        rawTelemetryB: mockTelemetryB,
        lapAObj: mockLapA,
        lapBObj: mockLapB,
      })
    );

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
