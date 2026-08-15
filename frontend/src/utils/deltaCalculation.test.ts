import { describe, it, expect } from 'vitest';
import { calculateMergedComparison, normalizeTelemetrySeries } from './deltaCalculation';
import type { TelemetrySamplePoint } from './downsample';

describe('deltaCalculation utility', () => {
  it('normalizes two laps with different raw distance scales to the exact same track length', () => {
    // Lap A: 101 samples, raw distance 0 to 5000m, duration 88s
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 101 }, (_, i) => ({
      lap_distance: i * 50,
      session_time: i * 0.88,
      speed: 200 + (i % 10) * 10,
      throttle: 1,
      brake: 0,
      gear: 6,
    }));

    // Lap B: 101 samples, raw distance 0 to 12000m (uncalibrated/accumulated), duration 89s
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 101 }, (_, i) => ({
      lap_distance: i * 120,
      session_time: i * 0.89,
      speed: 195 + (i % 10) * 10,
      throttle: 1,
      brake: 0,
      gear: 6,
    }));

    const merged = calculateMergedComparison(lapA, lapB, 10, 5000);

    expect(merged.length).toBeGreaterThan(0);

    // Max distance should be exactly 5000m
    const maxDist = merged[merged.length - 1].lap_distance;
    expect(maxDist).toBe(5000);

    // At 5000m (finish line), timeA should be ~87.12s, timeB should be ~88.11s, delta ~ -1.0s
    const finalPoint = merged[merged.length - 1];
    expect(finalPoint.time_delta).toBeLessThan(0); // Lap A is faster
    if (finalPoint.time_delta !== null) {
      expect(Math.abs(finalPoint.time_delta)).toBeLessThan(5.0); // Realistic delta < 5s, NOT 50s!
    }
  });

  it('aligns start distance at 0m and offsets initial time delta to 0.0s', () => {
    // Lap A first sample at 15m
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: 15 + i * 50,
      session_time: 100.27 + i * 0.92,
      speed: 200,
      throttle: 1,
      brake: 0,
    }));

    // Lap B first sample at 5m
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: 5 + i * 50,
      session_time: 200.09 + i * 0.92,
      speed: 200,
      throttle: 1,
      brake: 0,
    }));

    const merged = calculateMergedComparison(lapA, lapB, 10);
    // Comparison starts at exactly 0m
    expect(merged[0].lap_distance).toBe(0);
    // Initial time delta should be 0.0s
    expect(merged[0].time_delta).toBe(0);
  });

  it('correctly filters out aborted lap attempts and out-laps from telemetry series', () => {
    // Simulated dirty telemetry with 2 attempts
    const raw: TelemetrySamplePoint[] = [
      // Attempt 1 (aborted at 4000m)
      ...Array.from({ length: 80 }, (_, i) => ({
        lap_distance: i * 50,
        session_time: 100 + i * 1.0,
        speed: 200,
        throttle: 1,
        brake: 0,
      })),
      // Attempt 2 (completed lap: 0m to 4200m)
      ...Array.from({ length: 85 }, (_, i) => ({
        lap_distance: i * 50,
        session_time: 300 + i * 0.85,
        speed: 250,
        throttle: 1,
        brake: 0,
      })),
    ];

    const merged = calculateMergedComparison(raw, [], 10);
    expect(merged.length).toBeGreaterThan(0);
    // Maximum distance should correspond to the second (completed) attempt (~4200m)
    expect(merged[merged.length - 1].lap_distance).toBe(4200);
    // Speed should match Attempt 2 (250 km/h)
    expect(merged[0].speedA).toBe(250);
  });

  it('trims trailing wrap-around samples into the next lap', () => {
    const raw: TelemetrySamplePoint[] = [
      ...Array.from({ length: 100 }, (_, i) => ({
        lap_distance: i * 50, // 0m to 4950m
        session_time: 100 + i * 0.8,
        speed: 260,
        throttle: 1,
        brake: 0,
      })),
      // Trailing wrap-around samples
      { lap_distance: 2.5, session_time: 180.8, speed: 260, throttle: 1, brake: 0 },
      { lap_distance: 5.0, session_time: 180.9, speed: 260, throttle: 1, brake: 0 },
    ];

    const normalized = normalizeTelemetrySeries(raw);
    const lastPoint = normalized[normalized.length - 1];
    expect(lastPoint.lap_distance).toBe(4950);
  });
});


