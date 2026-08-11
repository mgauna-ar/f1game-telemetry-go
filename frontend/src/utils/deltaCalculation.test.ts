import { describe, it, expect } from 'vitest';
import { calculateMergedComparison } from './deltaCalculation';
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
});
