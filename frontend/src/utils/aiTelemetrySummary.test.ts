import { describe, it, expect } from 'vitest';
import { buildTelemetryContext } from './aiTelemetrySummary';
import type { MergedTelemetryPoint } from './deltaCalculation';

describe('buildTelemetryContext', () => {
  it('returns null if either lap is missing or comparison data is empty', () => {
    expect(
      buildTelemetryContext('Monza', 'Race', undefined, undefined, 'A', 'B', [], null)
    ).toBeNull();
  });

  it('builds a valid telemetry context when laps and samples are present', () => {
    const lapA = {
      id: 1,
      lap_number: 10,
      lap_time_ms: 80500,
      sector1_ms: 25000,
      sector2_ms: 28000,
      sector3_ms: 27500,
      is_valid: true,
      tyre_compound: 'SOFT',
    };
    const lapB = {
      id: 2,
      lap_number: 11,
      lap_time_ms: 81200,
      sector1_ms: 25200,
      sector2_ms: 28100,
      sector3_ms: 27900,
      is_valid: true,
      tyre_compound: 'MEDIUM',
    };

    const mockPoints: MergedTelemetryPoint[] = [
      {
        lap_distance: 0,
        time_delta: 0,
        timeA: 0,
        timeB: 0,
        speedA: 280,
        speedB: 275,
        speed_delta: 5,
        throttleA: 100,
        throttleB: 100,
        brakeA: 0,
        brakeB: 0,
        steerA: 0,
        steerB: 0,
        gearA: 7,
        gearB: 7,
        ersBatteryA: 95,
        ersBatteryB: 92,
        ersDeployModeA: 1,
        ersDeployModeB: 1,
      },
      {
        lap_distance: 500,
        time_delta: -0.15,
        timeA: 7.2,
        timeB: 7.35,
        speedA: 110,
        speedB: 105,
        speed_delta: 5,
        throttleA: 0,
        throttleB: 0,
        brakeA: 85,
        brakeB: 90,
        steerA: 15,
        steerB: 16,
        gearA: 3,
        gearB: 3,
        ersBatteryA: 90,
        ersBatteryB: 88,
        ersDeployModeA: 0,
        ersDeployModeB: 0,
      },
      {
        lap_distance: 1000,
        time_delta: -0.7,
        timeA: 80.5,
        timeB: 81.2,
        speedA: 310,
        speedB: 305,
        speed_delta: 5,
        throttleA: 100,
        throttleB: 100,
        brakeA: 0,
        brakeB: 0,
        steerA: 0,
        steerB: 0,
        gearA: 8,
        gearB: 8,
        ersBatteryA: 80,
        ersBatteryB: 75,
        ersDeployModeA: 2,
        ersDeployModeB: 1,
      },
    ];

    const ctx = buildTelemetryContext(
      'Monza',
      'Qualifying',
      lapA,
      lapB,
      'Verstappen',
      'Leclerc',
      mockPoints,
      [100, 600]
    );

    expect(ctx).not.toBeNull();
    expect(ctx?.track_name).toBe('Monza');
    expect(ctx?.lap_a_time_formatted).toBe('1:20.500');
    expect(ctx?.lap_b_time_formatted).toBe('1:21.200');
    expect(ctx?.time_delta_seconds).toBeCloseTo(-0.7);
    expect(ctx?.top_speed_a).toBe(310);
    expect(ctx?.top_speed_b).toBe(305);
    expect(ctx?.zoomed_range).toBeDefined();
    expect(ctx?.zoomed_range?.start_distance_meters).toBe(100);
    expect(ctx?.zoomed_range?.end_distance_meters).toBe(600);
  });
});
