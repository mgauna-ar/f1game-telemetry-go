import type { TelemetrySamplePoint } from './downsample';

export interface MergedTelemetryPoint {
  lap_distance: number;
  time_delta: number | null;
  timeA: number | null;
  timeB: number | null;
  speedA: number | null;
  speedB: number | null;
  speed_delta: number | null;
  throttleA: number | null;
  throttleB: number | null;
  brakeA: number | null;
  brakeB: number | null;
  steerA: number | null;
  steerB: number | null;
  gearA: number | null;
  gearB: number | null;
  ersBatteryA: number | null;
  ersBatteryB: number | null;
  ersDeployModeA: number | null;
  ersDeployModeB: number | null;
  worldX?: number | null;
  worldZ?: number | null;
}

/**
 * Cleans telemetry samples for comparison:
 * - Drops negative distances (e.g. from out-laps or invalid starts)
 * - Sorts by session_time
 * - Removes stale wrap-around samples from the previous lap at the start
 * - Removes wrap-around samples into the next lap at the end
 * - Deduplicates flat plateaus caused by sample rate mismatches
 * - Normalizes session_time to start at 0
 * - Enforces strict distance monotonicity for binary search interpolation
 */
export function normalizeTelemetrySeries(
  samples: TelemetrySamplePoint[]
): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];

  // Step 1: Filter invalid distances and sort by session_time
  const validSamples = samples.filter(s => (s.lap_distance ?? 0) >= 0);
  const sorted = [...validSamples].sort((a, b) => a.session_time - b.session_time);

  if (sorted.length < 2) return [];

  // Step 2: Find and remove stale samples from previous lap at the start.
  let cleanStartIdx = 0;
  const searchLimit = Math.min(sorted.length, 60);
  for (let i = 1; i < searchLimit; i++) {
    const prevDist = sorted[i - 1].lap_distance || 0;
    const currDist = sorted[i].lap_distance || 0;
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

  // Step 4: Deduplicate — keep only the LAST sample in each distance plateau
  const deduped: TelemetrySamplePoint[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const currDist = cleaned[i].lap_distance ?? 0;
    const nextDist = i < cleaned.length - 1 ? (cleaned[i + 1].lap_distance ?? 0) : -1;
    if (currDist !== nextDist) {
      deduped.push(cleaned[i]);
    }
  }

  if (deduped.length < 2) return [];

  const startTime = deduped[0].session_time;

  // Step 5: Build result enforcing strict monotonicity
  const result: TelemetrySamplePoint[] = [];
  let lastDist = -0.1;

  for (const s of deduped) {
    let dist = s.lap_distance ?? 0;

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
 * Returns null if the requested distance is outside the available data range.
 */
function interpolateAtDistance(
  samples: TelemetrySamplePoint[],
  key: keyof TelemetrySamplePoint,
  d: number
): number | null {
  if (samples.length === 0) return null;
  
  // Return null instead of clamping to avoid fake horizontal lines
  if (d < samples[0].lap_distance) return null;
  if (d > samples[samples.length - 1].lap_distance) return null;

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
 */
export function calculateMergedComparison(
  rawA: TelemetrySamplePoint[],
  rawB: TelemetrySamplePoint[],
  stepMeters: number = 5
): MergedTelemetryPoint[] {
  const normA = normalizeTelemetrySeries(rawA);
  const normB = normalizeTelemetrySeries(rawB);

  if (normA.length === 0 && normB.length === 0) return [];

  const startA = normA.length > 0 ? normA[0].lap_distance : 0;
  const startB = normB.length > 0 ? normB[0].lap_distance : 0;
  const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
  const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;

  // Use the UNION range to display the entire track
  let rangeStart: number;
  let rangeEnd: number;

  if (normA.length > 0 && normB.length > 0) {
    rangeStart = Math.min(startA, startB);
    rangeEnd = Math.max(endA, endB);
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

    const timeA = normA.length > 0 ? interpolateAtDistance(normA, 'session_time', dist) : null;
    const timeB = normB.length > 0 ? interpolateAtDistance(normB, 'session_time', dist) : null;
    const timeDelta = timeA !== null && timeB !== null ? Math.round((timeA - timeB) * 1000) / 1000 : null;

    const speedA = normA.length > 0 ? interpolateAtDistance(normA, 'speed', dist) : null;
    const speedB = normB.length > 0 ? interpolateAtDistance(normB, 'speed', dist) : null;
    const speedDelta = speedA !== null && speedB !== null ? Math.round(speedA) - Math.round(speedB) : null;

    const throttleA = normA.length > 0 ? interpolateAtDistance(normA, 'throttle', dist) : null;
    const throttleB = normB.length > 0 ? interpolateAtDistance(normB, 'throttle', dist) : null;

    const brakeA = normA.length > 0 ? interpolateAtDistance(normA, 'brake', dist) : null;
    const brakeB = normB.length > 0 ? interpolateAtDistance(normB, 'brake', dist) : null;

    const steerA = normA.length > 0 ? interpolateAtDistance(normA, 'steer', dist) : null;
    const steerB = normB.length > 0 ? interpolateAtDistance(normB, 'steer', dist) : null;

    const gearA = normA.length > 0 ? interpolateAtDistance(normA, 'gear', dist) : null;
    const gearB = normB.length > 0 ? interpolateAtDistance(normB, 'gear', dist) : null;

    const ersBatteryA = normA.length > 0 ? interpolateAtDistance(normA, 'ers_store_energy', dist) : null;
    const ersBatteryB = normB.length > 0 ? interpolateAtDistance(normB, 'ers_store_energy', dist) : null;

    const ersDeployModeA = normA.length > 0 ? interpolateAtDistance(normA, 'ers_deploy_mode', dist) : null;
    const ersDeployModeB = normB.length > 0 ? interpolateAtDistance(normB, 'ers_deploy_mode', dist) : null;

    const worldX = normA.length > 0 ? interpolateAtDistance(normA, 'world_pos_x', dist) : (normB.length > 0 ? interpolateAtDistance(normB, 'world_pos_x', dist) : null);
    const worldZ = normA.length > 0 ? interpolateAtDistance(normA, 'world_pos_z', dist) : (normB.length > 0 ? interpolateAtDistance(normB, 'world_pos_z', dist) : null);

    result.push({
      lap_distance: roundedDist,
      time_delta: timeDelta,
      timeA: timeA !== null ? Math.round(timeA * 1000) / 1000 : null,
      timeB: timeB !== null ? Math.round(timeB * 1000) / 1000 : null,
      speedA: speedA !== null ? Math.round(speedA) : null,
      speedB: speedB !== null ? Math.round(speedB) : null,
      speed_delta: speedDelta,
      throttleA: throttleA !== null ? Math.round(throttleA * 100) / 100 : null,
      throttleB: throttleB !== null ? Math.round(throttleB * 100) / 100 : null,
      brakeA: brakeA !== null ? Math.round(brakeA * 100) / 100 : null,
      brakeB: brakeB !== null ? Math.round(brakeB * 100) / 100 : null,
      steerA: steerA !== null ? Math.round(steerA * 100) / 100 : null,
      steerB: steerB !== null ? Math.round(steerB * 100) / 100 : null,
      gearA: gearA !== null ? Math.round(gearA) : null,
      gearB: gearB !== null ? Math.round(gearB) : null,
      ersBatteryA: ersBatteryA !== null ? Math.round(ersBatteryA * 10) / 10 : null,
      ersBatteryB: ersBatteryB !== null ? Math.round(ersBatteryB * 10) / 10 : null,
      ersDeployModeA: ersDeployModeA !== null ? Math.round(ersDeployModeA) : null,
      ersDeployModeB: ersDeployModeB !== null ? Math.round(ersDeployModeB) : null,
      worldX: worldX !== null ? worldX : undefined,
      worldZ: worldZ !== null ? worldZ : undefined,
    });
  }

  return result;
}
