import { describe, it, expect } from 'vitest';
import { detectTrackTurns } from './trackTurns';
import type { MergedTelemetryPoint } from './deltaCalculation';

describe('detectTrackTurns', () => {
  it('returns empty array for small or empty dataset', () => {
    expect(detectTrackTurns([])).toEqual([]);
    expect(detectTrackTurns([{ lap_distance: 0, time_delta: 0, speedA: 200 } as unknown as MergedTelemetryPoint])).toEqual([]);
  });

  it('detects turns in a synthetic oval track with two 180-degree corners', () => {
    // Generate synthetic oval with 2 hairpins (turns)
    const points: MergedTelemetryPoint[] = [];
    const totalPoints = 100;
    const lapLength = 2000;

    for (let i = 0; i < totalPoints; i++) {
      const dist = (i / totalPoints) * lapLength;
      const angle = (i / totalPoints) * Math.PI * 2;
      // Oval: stretch along X
      const worldX = Math.cos(angle) * 300;
      const worldZ = Math.sin(angle) * 100;
      // Slow down in corners (angle near 0 and PI)
      const speed = 100 + 100 * Math.abs(Math.sin(angle));

      points.push({
        lap_distance: dist,
        time_delta: 0,
        worldX,
        worldZ,
        speedA: speed,
        speedB: speed,
      } as unknown as MergedTelemetryPoint);
    }

    const turns = detectTrackTurns(points);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(turns[0].name).toBe('T1');
    expect(turns[1].name).toBe('T2');
    expect(turns[0].distance).toBeGreaterThanOrEqual(0);
  });
});
