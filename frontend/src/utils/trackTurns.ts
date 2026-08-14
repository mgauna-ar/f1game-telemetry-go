import type { MergedTelemetryPoint } from './deltaCalculation';

export interface TrackTurn {
  turnNumber: number;
  name: string;        // e.g. "T1", "T2", ...
  distance: number;    // meters along lap
  worldX: number;
  worldZ: number;
  speedA?: number;
  speedB?: number;
}

/**
 * Detects corners/turns along a track path using curvature and speed apex heuristics.
 */
export function detectTrackTurns(points: MergedTelemetryPoint[]): TrackTurn[] {
  const valid = points.filter(
    (p) => p.worldX !== undefined && p.worldZ !== undefined && (p.worldX !== 0 || p.worldZ !== 0)
  );

  if (valid.length < 20) return [];

  const turns: TrackTurn[] = [];
  const w = 4; // lookahead/lookbehind window
  const n = valid.length;

  // 1. Calculate heading angles along trajectory
  const headings: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const p1 = valid[Math.max(0, i - w)];
    const p2 = valid[Math.min(n - 1, i + w)];
    const dx = (p2.worldX ?? 0) - (p1.worldX ?? 0);
    const dz = (p2.worldZ ?? 0) - (p1.worldZ ?? 0);
    headings[i] = Math.atan2(dz, dx);
  }

  // 2. Calculate angular change rate (curvature)
  const curvatures: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    let diff = headings[i + 1] - headings[i - 1];
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const distStep = Math.max(1, (valid[i + 1].lap_distance || 0) - (valid[i - 1].lap_distance || 0));
    curvatures[i] = Math.abs(diff) / distStep;
  }

  // 3. Smooth curvatures with a rolling average
  const smoothed: number[] = new Array(n).fill(0);
  const smoothW = 4;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - smoothW); j <= Math.min(n - 1, i + smoothW); j++) {
      sum += curvatures[j];
      count++;
    }
    smoothed[i] = count > 0 ? sum / count : 0;
  }

  // 4. Find local peaks in curvature that correspond to turns
  const minTurnDistSpacing = 70; // minimum meters between consecutive turn apexes
  let lastTurnDist = -999;

  // Curvature threshold in rad/m
  const curvatureThreshold = 0.0025;

  for (let i = smoothW; i < n - smoothW; i++) {
    const cur = smoothed[i];
    const dist = valid[i].lap_distance || 0;

    // Check if local maximum above threshold
    if (
      cur > curvatureThreshold &&
      cur >= smoothed[i - 1] &&
      cur >= smoothed[i + 1] &&
      dist - lastTurnDist >= minTurnDistSpacing
    ) {
      // Find local speed minimum (apex) in a small radius around this curvature peak
      let apexIdx = i;
      let minSpeed = 999;
      const searchRadius = Math.min(8, Math.floor(n / 20));

      for (let k = Math.max(0, i - searchRadius); k <= Math.min(n - 1, i + searchRadius); k++) {
        const spd = valid[k].speedA ?? valid[k].speedB ?? 999;
        if (spd < minSpeed) {
          minSpeed = spd;
          apexIdx = k;
        }
      }

      const apexPt = valid[apexIdx];
      const turnNum = turns.length + 1;
      turns.push({
        turnNumber: turnNum,
        name: `T${turnNum}`,
        distance: Math.round(apexPt.lap_distance),
        worldX: apexPt.worldX!,
        worldZ: apexPt.worldZ!,
        speedA: apexPt.speedA ?? undefined,
        speedB: apexPt.speedB ?? undefined,
      });

      lastTurnDist = apexPt.lap_distance;
      i = apexIdx + 3; // skip ahead to avoid duplicate detection
    }
  }

  return turns;
}
