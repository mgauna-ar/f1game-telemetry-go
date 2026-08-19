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

  it('strips pre-start stationary countdown freeze samples and calculates correct delta', () => {
    // Lap A: normal lap (84.5s) starting at session_time 500s
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: i * 50, // 0m to 4950m
      session_time: 500 + i * 0.85,
      speed: 250,
      throttle: 1,
      brake: 0,
    }));

    // Lap B: had 30 seconds of stationary pre-start countdown/garage freeze at dist 0.0m
    const preStartFreeze: TelemetrySamplePoint[] = Array.from({ length: 30 }, (_, i) => ({
      lap_distance: 0.0,
      session_time: 600 + i * 1.0, // 600s to 629s (29s freeze)
      speed: 200,
      throttle: 1,
      brake: 0,
    }));

    // Lap B flying lap starting at session_time 630s (83.1s duration, faster by 1.4s)
    const flyingLapB: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: i * 50, // 0m to 4950m
      session_time: 630 + i * 0.835,
      speed: 255,
      throttle: 1,
      brake: 0,
    }));

    const lapB = [...preStartFreeze, ...flyingLapB];

    const merged = calculateMergedComparison(lapA, lapB, 50);
    expect(merged.length).toBeGreaterThan(0);
    // At start (0m), delta is 0
    expect(merged[0].time_delta).toBe(0);
    // Across the lap, delta should remain realistic (< 3s, not ~30s!)
    for (const pt of merged) {
      if (pt.time_delta !== null) {
        expect(Math.abs(pt.time_delta)).toBeLessThan(5.0);
      }
    }
    // At finish line, Lap B is ~1.45s faster (Lap A took 84.15s, Lap B took 82.66s, timeA - timeB ~ +1.48s)
    const finalPt = merged[merged.length - 1];
    expect(finalPt.time_delta).toBeGreaterThan(1.0);
    expect(finalPt.time_delta).toBeLessThan(2.0);
  });

  it('returns null delta when one lap is incomplete and stops short', () => {
    // Lap A: complete lap 0m to 5000m
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 101 }, (_, i) => ({
      lap_distance: i * 50,
      session_time: 100 + i * 0.85,
      speed: 250,
      throttle: 1,
      brake: 0,
    }));

    // Lap B: aborted/incomplete lap that only reached 200m
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 5 }, (_, i) => ({
      lap_distance: i * 50, // 0m to 200m
      session_time: 200 + i * 0.85,
      speed: 250,
      throttle: 1,
      brake: 0,
    }));

    const merged = calculateMergedComparison(lapA, lapB, 50);
    // At 100m (both have data): delta is 0
    const pt100 = merged.find(p => p.lap_distance === 100);
    expect(pt100).toBeDefined();
    expect(pt100?.time_delta).toBe(0);

    // At 1000m (only Lap A has data): delta should be null, NOT a flatlined fake number
    const pt1000 = merged.find(p => p.lap_distance === 1000);
    expect(pt1000).toBeDefined();
    expect(pt1000?.time_delta).toBeNull();
    expect(pt1000?.speedB).toBeNull();
    expect(pt1000?.speedA).toBe(250);
  });

  it('correctly handles out-lap with negative distances and garage glitches', () => {
    // Lap A: normal clean lap 0m to 5000m (85.0s duration)
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 101 }, (_, i) => ({
      lap_distance: i * 50,
      session_time: 500 + i * 0.85,
      speed: 250,
      throttle: 1,
      brake: 0,
    }));

    // Lap B: had 140s of pit lane / negative distance out-lap + 1-frame garage glitch before crossing the line
    const pitOutLap: TelemetrySamplePoint[] = [
      { lap_distance: -5000, session_time: 0, speed: 0, throttle: 0, brake: 0 },
      { lap_distance: 175, session_time: 5, speed: 0, throttle: 0, brake: 0 }, // 1-frame garage glitch
      { lap_distance: -5000, session_time: 6, speed: 0, throttle: 0, brake: 0 },
      { lap_distance: -50, session_time: 139, speed: 250, throttle: 1, brake: 0 },
      { lap_distance: -1, session_time: 139.9, speed: 250, throttle: 1, brake: 0 },
    ];

    // Flying lap starting at session_time 140s (85.1s duration, almost identical to Lap A)
    const flyingLapB: TelemetrySamplePoint[] = Array.from({ length: 101 }, (_, i) => ({
      lap_distance: i * 50,
      session_time: 140 + i * 0.851,
      speed: 250,
      throttle: 1,
      brake: 0,
    }));

    const lapB = [...pitOutLap, ...flyingLapB];

    const merged = calculateMergedComparison(lapA, lapB, 50);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged[0].time_delta).toBe(0);
    // Delta should remain close to 0 across the whole lap, NOT -140s!
    for (const pt of merged) {
      if (pt.time_delta !== null) {
        expect(Math.abs(pt.time_delta)).toBeLessThan(1.0);
      }
    }
  });

  it('accurately normalizes qualifying lap with 89.7m garage sample and 175s out-lap', () => {
    // Lap A (Silverstone Lap 1): starts with garage sample at 89.7m (t=0.274), out-lap (-5800m to -0.1m), then flying lap (0.2m to 5890.7m, t=175.463 to 264.856, dur=89.393s)
    const lapA: TelemetrySamplePoint[] = [
      { lap_distance: 89.7, session_time: 0.274, speed: 0, throttle: 0, brake: 0 },
      { lap_distance: -5801.0, session_time: 0.355, speed: 0, throttle: 0, brake: 0 },
      { lap_distance: -500.0, session_time: 160.0, speed: 200, throttle: 1, brake: 0 },
      { lap_distance: -1.0, session_time: 175.4, speed: 280, throttle: 1, brake: 0 },
      ...Array.from({ length: 60 }, (_, i) => ({
        lap_distance: 0.2 + i * 100, // 0.2m to ~5900m
        session_time: 175.463 + i * 1.515,
        speed: 280,
        throttle: 1,
        brake: 0,
      })),
      { lap_distance: 5890.7, session_time: 264.856, speed: 290, throttle: 1, brake: 0 },
    ];

    // Lap B (Silverstone Lap 2): clean flying lap 1.4m to 5887.3m, t=990.124 to 1079.811 (dur=89.687s)
    const lapB: TelemetrySamplePoint[] = [
      ...Array.from({ length: 60 }, (_, i) => ({
        lap_distance: 1.4 + i * 100,
        session_time: 990.124 + i * 1.520,
        speed: 275,
        throttle: 1,
        brake: 0,
      })),
      { lap_distance: 5887.3, session_time: 1079.811, speed: 285, throttle: 1, brake: 0 },
    ];

    const merged = calculateMergedComparison(lapA, lapB, 50);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged[0].time_delta).toBe(0);
    // Delta should remain smooth and < 1.5s across the entire lap, NOT +180s!
    for (const pt of merged) {
      if (pt.time_delta !== null) {
        expect(Math.abs(pt.time_delta)).toBeLessThan(2.0);
      }
    }
    // Lap A is slightly faster (~0.3s)
    const lastPt = merged[merged.length - 1];
    expect(lastPt.time_delta).toBeLessThan(0);
  });

  it('keeps both traces and delta continuous across finish line when laps have >70m distance difference', () => {
    // Lap A: 5320m total distance
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 107 }, (_, i) => ({
      lap_distance: i * 50, // 0m to 5300m
      session_time: 100 + i * 0.82,
      speed: 260,
      throttle: 1,
      brake: 0,
      gear: 7,
    }));
    lapA.push({ lap_distance: 5320, session_time: 187.5, speed: 265, throttle: 1, brake: 0, gear: 7 });

    // Lap B: 5240m total distance (80m shorter due to tighter racing line)
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 105 }, (_, i) => ({
      lap_distance: i * 50, // 0m to 5200m
      session_time: 200 + i * 0.81,
      speed: 262,
      throttle: 1,
      brake: 0,
      gear: 7,
    }));
    lapB.push({ lap_distance: 5240, session_time: 284.8, speed: 267, throttle: 1, brake: 0, gear: 7 });

    const merged = calculateMergedComparison(lapA, lapB, 20);
    expect(merged.length).toBeGreaterThan(0);

    // Final point should reach 5320m
    const finalPt = merged[merged.length - 1];
    expect(finalPt.lap_distance).toBe(5320);

    // Lap B should NOT be null at the end; it clamps smoothly to final sample
    expect(finalPt.speedB).not.toBeNull();
    expect(finalPt.speedB).toBe(267);
    expect(finalPt.speedA).toBe(265);
    expect(finalPt.time_delta).not.toBeNull();
    expect(finalPt.throttleB).toBe(1);
    expect(finalPt.gearB).toBe(7);
  });

  it('handles telemetry starting late (>60m) without uncalibrated delta jump', () => {
    // Lap A starts at 75m (e.g. crossing start line at 320 km/h)
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: 75 + i * 50,
      session_time: 500.8 + i * 0.85,
      speed: 280,
      throttle: 1,
      brake: 0,
      gear: 8,
    }));

    // Lap B starts at 10m
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 100 }, (_, i) => ({
      lap_distance: 10 + i * 50,
      session_time: 800.2 + i * 0.845,
      speed: 275,
      throttle: 1,
      brake: 0,
      gear: 8,
    }));

    const merged = calculateMergedComparison(lapA, lapB, 25);
    expect(merged.length).toBeGreaterThan(0);

    // Start distance is 0m
    expect(merged[0].lap_distance).toBe(0);
    expect(merged[0].time_delta).toBe(0);

    // Delta should remain small throughout (< 3s, not 300s!)
    for (const pt of merged) {
      if (pt.time_delta !== null) {
        expect(Math.abs(pt.time_delta)).toBeLessThan(5.0);
      }
    }
  });

  it('filters out isolated distance spike without discarding remaining lap samples', () => {
    const rawWithSpike: TelemetrySamplePoint[] = [
      { lap_distance: 0, session_time: 100, speed: 200, throttle: 1, brake: 0 },
      { lap_distance: 100, session_time: 101, speed: 220, throttle: 1, brake: 0 },
      { lap_distance: 200, session_time: 102, speed: 230, throttle: 1, brake: 0 },
      { lap_distance: 3500, session_time: 102.5, speed: 230, throttle: 1, brake: 0 }, // Isolated glitch spike!
      { lap_distance: 300, session_time: 103, speed: 240, throttle: 1, brake: 0 },
      { lap_distance: 400, session_time: 104, speed: 250, throttle: 1, brake: 0 },
      { lap_distance: 500, session_time: 105, speed: 260, throttle: 1, brake: 0 },
      ...Array.from({ length: 50 }, (_, i) => ({
        lap_distance: 600 + i * 50,
        session_time: 106 + i * 0.8,
        speed: 270,
        throttle: 1,
        brake: 0,
      })),
    ];

    const normalized = normalizeTelemetrySeries(rawWithSpike);
    // Should retain samples past 300m rather than truncating them
    expect(normalized.length).toBeGreaterThan(50);
    const hasSampleAt300 = normalized.some((s) => s.lap_distance === 300);
    expect(hasSampleAt300).toBe(true);
    const hasSampleAt500 = normalized.some((s) => s.lap_distance === 500);
    expect(hasSampleAt500).toBe(true);
  });

  it('gracefully handles non-finite / NaN values in input samples', () => {
    const dirtySamples: TelemetrySamplePoint[] = [
      { lap_distance: NaN, session_time: NaN, speed: 200, throttle: 1, brake: 0 },
      { lap_distance: 0, session_time: 100, speed: NaN, throttle: 1, brake: 0 },
      { lap_distance: 50, session_time: 101, speed: 250, throttle: 1, brake: 0 },
      { lap_distance: 100, session_time: 102, speed: 260, throttle: 1, brake: 0 },
    ];

    const merged = calculateMergedComparison(dirtySamples, [], 25);
    expect(merged.length).toBeGreaterThan(0);
    for (const pt of merged) {
      expect(Number.isFinite(pt.lap_distance)).toBe(true);
      if (pt.speedA !== null) {
        expect(Number.isFinite(pt.speedA)).toBe(true);
      }
    }
  });

  it('correctly extracts full completed lap when Lap 1 starts from grid slot and has trailing wrap-around tail', () => {
    // Lap 1: Starts on grid at 275m, accelerates to 5417m (duration ~97s)
    const flyingLap1: TelemetrySamplePoint[] = Array.from({ length: 60 }, (_, i) => ({
      lap_distance: 275 + i * 85, // 275m to ~5290m
      session_time: 0.5 + i * 1.6,
      speed: 250,
      throttle: 1,
      brake: 0,
      gear: 7,
    }));
    flyingLap1.push({ lap_distance: 5417, session_time: 97.0, speed: 270, throttle: 1, brake: 0, gear: 7 });

    // Trailing wrap-around / cooldown tail at end of session (0m to 275m, speed 0)
    const trailingTail: TelemetrySamplePoint[] = Array.from({ length: 30 }, (_, i) => ({
      lap_distance: i * 9, // 0m to 270m
      session_time: 98.0 + i * 1.5,
      speed: 0,
      throttle: 0,
      brake: 0,
      gear: 1,
    }));

    const rawLap1 = [...flyingLap1, ...trailingTail];

    // Lap 2 (flying lap 0m to 5417m, duration ~86s)
    const flyingLap2: TelemetrySamplePoint[] = Array.from({ length: 65 }, (_, i) => ({
      lap_distance: i * 84, // 0m to ~5376m
      session_time: 100 + i * 1.32,
      speed: 260,
      throttle: 1,
      brake: 0,
      gear: 7,
    }));
    flyingLap2.push({ lap_distance: 5417, session_time: 186.0, speed: 275, throttle: 1, brake: 0, gear: 7 });

    const merged = calculateMergedComparison(rawLap1, flyingLap2, 25);
    expect(merged.length).toBeGreaterThan(0);

    // Max distance should be the full track length (~5417m), NOT truncated to 275m!
    const maxDist = merged[merged.length - 1].lap_distance;
    expect(maxDist).toBe(5417);

    // Mid-track sample at 3000m should have valid speed and data from Lap 1
    const pt3000 = merged.find((p) => p.lap_distance === 3000);
    expect(pt3000).toBeDefined();
    expect(pt3000?.speedA).toBe(250);
    expect(pt3000?.speedB).toBe(260);
    expect(pt3000?.time_delta).not.toBeNull();
  });

  it('filters uninitialized distance dropouts (speed > 30 km/h with distance 0m mid-lap)', () => {
    const rawWithDropouts: TelemetrySamplePoint[] = [
      { lap_distance: 275, session_time: 0.5, speed: 100, throttle: 1, brake: 0 },
      { lap_distance: 1000, session_time: 15.0, speed: 250, throttle: 1, brake: 0 },
      { lap_distance: 0.0, session_time: 15.05, speed: 250, throttle: 1, brake: 0 }, // dropout
      { lap_distance: 1010, session_time: 15.1, speed: 250, throttle: 1, brake: 0 },
      { lap_distance: 2500, session_time: 40.0, speed: 270, throttle: 1, brake: 0 },
      { lap_distance: 0.0, session_time: 40.05, speed: 270, throttle: 1, brake: 0 }, // dropout
      { lap_distance: 2520, session_time: 40.1, speed: 270, throttle: 1, brake: 0 },
      { lap_distance: 5400, session_time: 90.0, speed: 280, throttle: 1, brake: 0 },
    ];

    const normalized = normalizeTelemetrySeries(rawWithDropouts);
    expect(normalized.length).toBeGreaterThan(0);
    const maxDist = normalized[normalized.length - 1].lap_distance;
    expect(maxDist).toBe(5400);
  });

  it('accurately computes time delta between two standing grid starts without false 30s spike', () => {
    // Lap A (Arti Moreno): Starts at 275m at t=0.5s, finishes at 5417m at t=97.5s (dur = 97.0s)
    const lapA: TelemetrySamplePoint[] = Array.from({ length: 60 }, (_, i) => ({
      lap_distance: 275 + i * 85,
      session_time: 0.5 + i * 1.6, // 0.5s to 94.9s
      speed: 250,
      throttle: 1,
      brake: 0,
      world_pos_x: 100 + i * 5,
      world_pos_z: 200 + i * 5,
    }));
    lapA.push({ lap_distance: 5417, session_time: 97.5, speed: 270, throttle: 1, brake: 0, world_pos_x: 400, world_pos_z: 500 });

    // Lap B (LC-iL.Magno): Starts at 185m at t=3.0s, finishes at 5417m at t=105.0s (dur = 102.0s)
    const lapB: TelemetrySamplePoint[] = Array.from({ length: 60 }, (_, i) => ({
      lap_distance: 185 + i * 87,
      session_time: 3.0 + i * 1.7, // 3.0s to 103.3s
      speed: 240,
      throttle: 1,
      brake: 0,
      world_pos_x: 90 + i * 5,
      world_pos_z: 190 + i * 5,
    }));
    lapB.push({ lap_distance: 5417, session_time: 105.0, speed: 260, throttle: 1, brake: 0, world_pos_x: 400, world_pos_z: 500 });

    const merged = calculateMergedComparison(lapA, lapB, 25);
    expect(merged.length).toBeGreaterThan(0);

    // Initial delta at 0m must be 0.0s
    expect(merged[0].time_delta).toBe(0);

    // Delta throughout the lap should stay realistic (< 10s, never +30s or +99s!)
    for (const pt of merged) {
      if (pt.time_delta !== null) {
        expect(Math.abs(pt.time_delta)).toBeLessThan(10.0);
      }
    }

    // Final delta should be ~ -5.0s (Lap A is 5s faster: 97.0s vs 102.0s)
    const finalDelta = merged[merged.length - 1].time_delta;
    expect(finalDelta).not.toBeNull();
    expect(finalDelta!).toBeCloseTo(-5.0, 1);
  });
});





