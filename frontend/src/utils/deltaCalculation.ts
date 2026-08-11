import type { TelemetrySamplePoint } from './downsample';

export interface MergedTelemetryPoint {
  lap_distance: number;
  time_delta: number;
  timeA: number;
  timeB: number;
  speedA: number;
  speedB: number;
  speed_delta: number;
  throttleA: number;
  throttleB: number;
  brakeA: number;
  brakeB: number;
  steerA: number;
  steerB: number;
  gearA: number;
  gearB: number;
  ersBatteryA: number;
  ersBatteryB: number;
  ersDeployModeA: number;
  ersDeployModeB: number;
  worldX?: number;
  worldZ?: number;
}

/**
 * Cleans telemetry samples for comparison:
 * - Sorts by session_time
 * - Removes stale wrap-around samples from the previous lap at the start
 * - Removes wrap-around samples into the next lap at the end
 * - Normalizes session_time to start at 0
 * - Keeps raw lap_distance AS-IS (the F1 game's lap_distance is already
 *   relative to the S/F line, so both laps share the same coordinate system)
 * - Enforces strict distance monotonicity for binary search interpolation
 */
export function normalizeTelemetrySeries(
  samples: TelemetrySamplePoint[]
): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];

  // Step 1: Sort by session_time to guarantee temporal ordering
  const sorted = [...samples].sort((a, b) => a.session_time - b.session_time);

  // Step 2: Find and remove stale samples from previous lap at the start.
  // These are samples where lap_distance is still at the end of the previous lap
  // (e.g., 5390m) before LapData packet updates it to near 0m.
  let cleanStartIdx = 0;
  const searchLimit = Math.min(sorted.length, 60);
  for (let i = 1; i < searchLimit; i++) {
    const prevDist = sorted[i - 1].lap_distance || 0;
    const currDist = sorted[i].lap_distance || 0;
    // Big drop = the previous samples were stale from prior lap
    if (prevDist > 1000 && currDist < prevDist * 0.3) {
      cleanStartIdx = i;
      break;
    }
  }

  // Step 3: Find and remove samples that wrapped into the next lap at the end
  let cleanEndIdx = sorted.length;
  for (let i = sorted.length - 1; i > Math.max(0, sorted.length - 60); i--) {
    const prevDist = sorted[i - 1].lap_distance || 0;
    const currDist = sorted[i].lap_distance || 0;
    if (prevDist > 1000 && currDist < prevDist * 0.3) {
      cleanEndIdx = i;
      break;
    }
  }

  const cleaned = sorted.slice(cleanStartIdx, cleanEndIdx);
  if (cleaned.length < 2) return [];

  // Step 4: Deduplicate — when ProcessTelemetry (60Hz) outpaces ProcessLapData
  // (20Hz), many consecutive samples share the same lap_distance value but have
  // increasing session_time. Keep only the LAST sample in each "plateau" so
  // each distance maps to the most up-to-date time.
  const deduped: TelemetrySamplePoint[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const currDist = cleaned[i].lap_distance ?? 0;
    const nextDist = i < cleaned.length - 1 ? (cleaned[i + 1].lap_distance ?? 0) : -1;
    // Keep sample only if the next sample has a DIFFERENT distance (i.e., this
    // is the last sample in a plateau), or if it's the very last sample.
    if (currDist !== nextDist) {
      deduped.push(cleaned[i]);
    }
  }

  if (deduped.length < 2) return [];

  const startTime = deduped[0].session_time;

  // Step 5: Build result using raw lap_distance, enforcing strict monotonicity
  const result: TelemetrySamplePoint[] = [];
  let lastDist = -0.1;

  for (const s of deduped) {
    let dist = s.lap_distance ?? 0;

    // Enforce strict monotonicity for binary search
    if (dist <= lastDist) {
      dist = Math.round((lastDist + 0.1) * 10) / 10;
    }
    lastDist = dist;

    result.push({
      ...s,
      lap_distance: Math.round(dist * 10) / 10,
      session_time: Math.round((s.session_time - startTime) * 1000) / 1000,
    });
  }

  return result;
}

/**
 * Interpolates a value from a strictly-sorted-by-distance array at distance d.
 */
function interpolateAtDistance(
  samples: TelemetrySamplePoint[],
  key: keyof TelemetrySamplePoint,
  d: number
): number {
  if (samples.length === 0) return 0;
  if (d <= samples[0].lap_distance) return (samples[0][key] as number) ?? 0;
  if (d >= samples[samples.length - 1].lap_distance)
    return (samples[samples.length - 1][key] as number) ?? 0;

  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].lap_distance === d) {
      return (samples[mid][key] as number) ?? 0;
    }
    if (samples[mid].lap_distance < d) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx1 = Math.max(0, high);
  const idx2 = Math.min(samples.length - 1, low);
  if (idx1 === idx2) return (samples[idx1][key] as number) ?? 0;

  const d1 = samples[idx1].lap_distance;
  const d2 = samples[idx2].lap_distance;
  const v1 = (samples[idx1][key] as number) ?? 0;
  const v2 = (samples[idx2][key] as number) ?? 0;
  if (d2 === d1) return v1;

  const factor = (d - d1) / (d2 - d1);
  return v1 + factor * (v2 - v1);
}

/**
 * Merges two normalized telemetry series onto a common distance grid.
 * Uses the OVERLAPPING distance range (where BOTH laps have data) to avoid
 * edge-clamping artifacts that create fake time deltas.
 */
export function calculateMergedComparison(
  rawA: TelemetrySamplePoint[],
  rawB: TelemetrySamplePoint[],
  stepMeters: number = 5
): MergedTelemetryPoint[] {
  const normA = normalizeTelemetrySeries(rawA);
  const normB = normalizeTelemetrySeries(rawB);

  if (normA.length === 0 && normB.length === 0) return [];

  // Use the OVERLAPPING range: from max(startA, startB) to min(endA, endB)
  // This avoids clamping artifacts at edges where only one lap has data
  const startA = normA.length > 0 ? normA[0].lap_distance : 0;
  const startB = normB.length > 0 ? normB[0].lap_distance : 0;
  const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
  const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;

  let rangeStart: number;
  let rangeEnd: number;

  if (normA.length > 0 && normB.length > 0) {
    rangeStart = Math.max(startA, startB);
    rangeEnd = Math.min(endA, endB);
  } else if (normA.length > 0) {
    rangeStart = startA;
    rangeEnd = endA;
  } else {
    rangeStart = startB;
    rangeEnd = endB;
  }

  if (rangeEnd <= rangeStart) return [];

  const result: MergedTelemetryPoint[] = [];

  for (let dist = rangeStart; dist <= rangeEnd; dist += stepMeters) {
    const roundedDist = Math.round(dist * 10) / 10;

    const timeA = normA.length > 0 ? interpolateAtDistance(normA, 'session_time', dist) : 0;
    const timeB = normB.length > 0 ? interpolateAtDistance(normB, 'session_time', dist) : 0;
    const timeDelta = Math.round((timeA - timeB) * 1000) / 1000;

    const speedA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'speed', dist)) : 0;
    const speedB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'speed', dist)) : 0;

    const throttleA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'throttle', dist) * 100) / 100 : 0;
    const throttleB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'throttle', dist) * 100) / 100 : 0;

    const brakeA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'brake', dist) * 100) / 100 : 0;
    const brakeB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'brake', dist) * 100) / 100 : 0;

    const steerA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'steer', dist) * 100) / 100 : 0;
    const steerB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'steer', dist) * 100) / 100 : 0;

    const gearA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'gear', dist)) : 0;
    const gearB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'gear', dist)) : 0;

    const ersBatteryA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'ers_store_energy', dist) * 10) / 10 : 0;
    const ersBatteryB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'ers_store_energy', dist) * 10) / 10 : 0;

    const ersDeployModeA = normA.length > 0 ? Math.round(interpolateAtDistance(normA, 'ers_deploy_mode', dist)) : 0;
    const ersDeployModeB = normB.length > 0 ? Math.round(interpolateAtDistance(normB, 'ers_deploy_mode', dist)) : 0;

    const worldX = normA.length > 0 ? interpolateAtDistance(normA, 'world_pos_x', dist) : (normB.length > 0 ? interpolateAtDistance(normB, 'world_pos_x', dist) : 0);
    const worldZ = normA.length > 0 ? interpolateAtDistance(normA, 'world_pos_z', dist) : (normB.length > 0 ? interpolateAtDistance(normB, 'world_pos_z', dist) : 0);

    result.push({
      lap_distance: roundedDist,
      time_delta: timeDelta,
      timeA: Math.round(timeA * 1000) / 1000,
      timeB: Math.round(timeB * 1000) / 1000,
      speedA,
      speedB,
      speed_delta: speedA - speedB,
      throttleA,
      throttleB,
      brakeA,
      brakeB,
      steerA,
      steerB,
      gearA,
      gearB,
      ersBatteryA,
      ersBatteryB,
      ersDeployModeA,
      ersDeployModeB,
      worldX,
      worldZ,
    });
  }

  return result;
}
