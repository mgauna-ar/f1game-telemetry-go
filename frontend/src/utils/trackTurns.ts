import type { MergedTelemetryPoint } from './deltaCalculation';

export interface TrackTurn {
  turnNumber: number;
  name: string;        // e.g. "T1", "T2", ...
  distance: number;    // apex meters along lap
  entryDistance: number;
  exitDistance: number;
  worldX: number;
  worldZ: number;
  normalX: number;     // unit normal vector pointing outside the curve (for label offset)
  normalZ: number;
  speedA?: number;
  speedB?: number;
}

export interface TurnContextInfo {
  turn: TrackTurn | null;
  phase: 'entry' | 'apex' | 'exit' | 'straight';
  label: string;
}

/**
 * Detects corners/turns along a track path using curvature and speed apex heuristics,
 * and calculates outward normal vectors for clean label placement outside the racing line.
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

      // Calculate outward normal vector for apex
      // We look at trajectory before and after apex:
      const pPrev = valid[Math.max(0, apexIdx - 3)];
      const pNext = valid[Math.min(n - 1, apexIdx + 3)];
      const v1x = apexPt.worldX! - pPrev.worldX!;
      const v1z = apexPt.worldZ! - pPrev.worldZ!;
      const v2x = pNext.worldX! - apexPt.worldX!;
      const v2z = pNext.worldZ! - apexPt.worldZ!;

      // Curvature acceleration points towards center of curve (inward)
      const ax = v2x - v1x;
      const az = v2z - v1z;
      const aLen = Math.hypot(ax, az);

      let normX = 0;
      let normZ = 0;
      if (aLen > 0.0001) {
        // Outward normal is opposite of inward acceleration
        normX = -ax / aLen;
        normZ = -az / aLen;
      } else {
        // Fallback to perpendicular of tangent
        const tx = pNext.worldX! - pPrev.worldX!;
        const tz = pNext.worldZ! - pPrev.worldZ!;
        const tLen = Math.hypot(tx, tz) || 1;
        normX = -tz / tLen;
        normZ = tx / tLen;
      }

      const turnNum = turns.length + 1;
      const apexDist = Math.round(apexPt.lap_distance);
      turns.push({
        turnNumber: turnNum,
        name: `T${turnNum}`,
        distance: apexDist,
        entryDistance: Math.max(0, apexDist - 35),
        exitDistance: apexDist + 35,
        worldX: apexPt.worldX!,
        worldZ: apexPt.worldZ!,
        normalX: normX,
        normalZ: normZ,
        speedA: apexPt.speedA ?? undefined,
        speedB: apexPt.speedB ?? undefined,
      });

      lastTurnDist = apexPt.lap_distance;
      i = apexIdx + 3; // skip ahead to avoid duplicate detection
    }
  }

  return turns;
}

/**
 * Returns contextual description of where the car / cursor is relative to turns
 */
export function getTurnContextAtDistance(turns: TrackTurn[], distance: number | null | undefined): TurnContextInfo {
  if (distance === null || distance === undefined || turns.length === 0) {
    return { turn: null, phase: 'straight', label: '' };
  }

  // 1. Check if inside turn apex/entry/exit zone
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const diff = distance - t.distance;

    // Apex zone: ±15 meters
    if (Math.abs(diff) <= 15) {
      return { turn: t, phase: 'apex', label: `${t.name} (Apex)` };
    }
    // Entry zone: -45m to -15m
    if (diff > -45 && diff < -15) {
      return { turn: t, phase: 'entry', label: `${t.name} (Entry)` };
    }
    // Exit zone: +15m to +45m
    if (diff > 15 && diff < 45) {
      return { turn: t, phase: 'exit', label: `${t.name} (Exit)` };
    }
  }

  // 2. If between turns, find which ones
  for (let i = 0; i < turns.length - 1; i++) {
    const t1 = turns[i];
    const t2 = turns[i + 1];
    if (distance >= t1.distance && distance <= t2.distance) {
      return { turn: null, phase: 'straight', label: `Straight (${t1.name} → ${t2.name})` };
    }
  }

  if (distance < turns[0].distance) {
    return { turn: null, phase: 'straight', label: `Main Straight (Start → ${turns[0].name})` };
  }

  const lastTurn = turns[turns.length - 1];
  return { turn: null, phase: 'straight', label: `Final Straight (${lastTurn.name} → Finish)` };
}
