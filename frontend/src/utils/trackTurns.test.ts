import { describe, it, expect } from 'vitest';
import { analyzeCorners, getTurnContextAtDistance } from './trackTurns';
import type { MergedTelemetryPoint, TrackTurn } from '../types/comparator';

describe('getTurnContextAtDistance', () => {
  const mockTurns: TrackTurn[] = [
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

  it('handles start and final straight segments correctly', () => {
    const beforeFirst = getTurnContextAtDistance(mockTurns, 100);
    expect(beforeFirst.label).toBe('Main Straight (Start → T1)');

    const afterLast = getTurnContextAtDistance(mockTurns, 1200);
    expect(afterLast.label).toBe('Final Straight (T2 → Finish)');
  });

  it('handles null/undefined gracefully', () => {
    expect(getTurnContextAtDistance([], null)).toEqual({ turn: null, phase: 'straight', label: '' });
    expect(getTurnContextAtDistance([], undefined)).toEqual({ turn: null, phase: 'straight', label: '' });
  });
});

describe('analyzeCorners', () => {
  const turn = (name: string, distance: number): TrackTurn => ({
    turnNumber: Number(name.slice(1)),
    name,
    distance,
    entryDistance: distance - 35,
    exitDistance: distance + 35,
    worldX: 0,
    worldZ: 0,
    normalX: 0,
    normalZ: 1,
  });

  // One lap: slot A brakes at 350 m and slows to 100 km/h at the 500 m apex, back on the power at
  // 520 m; slot B brakes later (380 m), keeps 110 km/h and picks up the throttle at 510 m.
  const lap = (brakeAt: number, minSpeed: number, throttleAt: number) => (d: number) => {
    const braking = d >= brakeAt && d < 500;
    const speed =
      d < brakeAt ? 300 : d <= 500 ? 300 - ((300 - minSpeed) * (d - brakeAt)) / (500 - brakeAt) : minSpeed + (d - 500);
    return { speed, brake: braking ? 0.8 : 0, throttle: d >= throttleAt || d < brakeAt ? 1 : 0 };
  };
  const a = lap(350, 100, 520);
  const b = lap(380, 110, 510);
  const points: MergedTelemetryPoint[] = [];
  for (let d = 0; d <= 1000; d += 5) {
    const pa = a(d);
    const pb = b(d);
    points.push({
      lap_distance: d,
      time_delta: d < 300 ? 0 : Math.min(0.2, ((d - 300) / 350) * 0.2),
      timeA: null,
      timeB: null,
      speedA: pa.speed,
      speedB: pb.speed,
      speed_delta: null,
      throttleA: pa.throttle,
      throttleB: pb.throttle,
      brakeA: pa.brake,
      brakeB: pb.brake,
      steerA: null,
      steerB: null,
      gearA: null,
      gearB: null,
      ersBatteryA: null,
      ersBatteryB: null,
      ersDeployModeA: null,
      ersDeployModeB: null,
    });
  }

  it('measures each lap through the corner and the time lost there', () => {
    const [corner] = analyzeCorners(points, [turn('T1', 500)]);
    expect(corner.range).toEqual([250, 650]);
    expect(corner.a).toEqual({ entrySpeed: 300, minSpeed: 100, brakingBeforeApex: 150, throttleFromApex: 20 });
    expect(corner.b).toEqual({ entrySpeed: 300, minSpeed: 110, brakingBeforeApex: 120, throttleFromApex: 10 });
    expect(corner.timeDelta).toBeCloseTo(0.2);
  });

  it('splits the lap halfway between apexes', () => {
    const corners = analyzeCorners(points, [turn('T2', 700), turn('T1', 500)]);
    expect(corners.map((c) => c.turn.name)).toEqual(['T1', 'T2']);
    expect(corners[0].range).toEqual([250, 600]);
    expect(corners[1].range).toEqual([600, 850]);
  });

  it('leaves out what a lap without telemetry cannot say', () => {
    const onlyA = points.map((p) => ({ ...p, speedB: null, brakeB: null, throttleB: null }));
    const [corner] = analyzeCorners(onlyA, [turn('T1', 500)]);
    expect(corner.b).toEqual({ entrySpeed: null, minSpeed: null, brakingBeforeApex: null, throttleFromApex: null });
    expect(analyzeCorners([], [turn('T1', 500)])).toEqual([]);
  });
});
