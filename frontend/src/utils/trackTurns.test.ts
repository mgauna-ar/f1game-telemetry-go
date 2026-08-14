import { describe, it, expect } from 'vitest';
import { detectTrackTurns, getTurnContextAtDistance } from './trackTurns';
import type { MergedTelemetryPoint } from './deltaCalculation';

describe('detectTrackTurns', () => {
  it('returns empty array for small or empty dataset', () => {
    expect(detectTrackTurns([])).toEqual([]);
    expect(detectTrackTurns([{ lap_distance: 0, time_delta: 0, speedA: 200 } as unknown as MergedTelemetryPoint])).toEqual([]);
  });

  it('detects turns in a synthetic oval track with two 180-degree corners and computes outward normals', () => {
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
    expect(typeof turns[0].normalX).toBe('number');
    expect(typeof turns[0].normalZ).toBe('number');
    expect(turns[0].entryDistance).toBeLessThan(turns[0].distance);
    expect(turns[0].exitDistance).toBeGreaterThan(turns[0].distance);
  });
});

describe('getTurnContextAtDistance', () => {
  const mockTurns = [
    {
      turnNumber: 1,
      name: 'T1',
      distance: 500,
      entryDistance: 465,
      exitDistance: 535,
      worldX: 100,
      worldZ: 100,
      normalX: 0,
      normalZ: 1,
    },
    {
      turnNumber: 2,
      name: 'T2',
      distance: 1000,
      entryDistance: 965,
      exitDistance: 1035,
      worldX: 200,
      worldZ: 200,
      normalX: 1,
      normalZ: 0,
    },
  ];

  it('returns straight info when distance is outside turn apex zones', () => {
    const res = getTurnContextAtDistance(mockTurns, 200);
    expect(res.phase).toBe('straight');
    expect(res.label).toContain('T1');
  });

  it('returns entry info when approaching a turn', () => {
    const res = getTurnContextAtDistance(mockTurns, 475);
    expect(res.phase).toBe('entry');
    expect(res.label).toBe('T1 (Entry)');
    expect(res.turn?.name).toBe('T1');
  });

  it('returns apex info when at the turn apex', () => {
    const res = getTurnContextAtDistance(mockTurns, 505);
    expect(res.phase).toBe('apex');
    expect(res.label).toBe('T1 (Apex)');
    expect(res.turn?.name).toBe('T1');
  });

  it('returns exit info when exiting the turn', () => {
    const res = getTurnContextAtDistance(mockTurns, 530);
    expect(res.phase).toBe('exit');
    expect(res.label).toBe('T1 (Exit)');
  });

  it('handles null/undefined gracefully', () => {
    expect(getTurnContextAtDistance([], null)).toEqual({ turn: null, phase: 'straight', label: '' });
  });
});
