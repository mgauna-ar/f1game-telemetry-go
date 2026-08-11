import type { TelemetrySamplePoint } from './downsample';

export interface MergedTelemetryPoint {
  lap_distance: number;
  // Time Delta (seconds): negative means Lap A is faster, positive means Lap B is faster
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
 * Cleans wrap-around artifacts, subtracts start distance offset,
 * and enforces strict distance monotonicity for binary search interpolation.
 */
export function normalizeTelemetrySeries(samples: TelemetrySamplePoint[]): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];

  // Step 1: Filter out out-of-order start samples (e.g. sample 0 is at 5190m before crossing S/F line)
  let validStartIdx = 0;
  if (samples.length > 5) {
    const firstDist = samples[0].lap_distance || 0;
    const secondDist = samples[1].lap_distance || 0;
    if (firstDist > 2000 && secondDist < 500) {
      while (validStartIdx < samples.length - 1 && (samples[validStartIdx].lap_distance || 0) > 1000) {
        validStartIdx++;
      }
    }
  }

  let cleaned = samples.slice(validStartIdx);
  if (cleaned.length === 0) return [];

  // Step 2: Filter out trailing samples that wrapped around to the next lap
  let validEndIdx = cleaned.length;
  if (cleaned.length > 5) {
    const maxDist = Math.max(...cleaned.map((s) => s.lap_distance || 0));
    if (maxDist > 1000) {
      for (let i = cleaned.length - 1; i > 0; i--) {
        const curr = cleaned[i].lap_distance || 0;
        const prev = cleaned[i - 1].lap_distance || 0;
        if (curr < maxDist * 0.2 && prev > maxDist * 0.8) {
          validEndIdx = i;
          break;
        }
      }
    }
  }
  cleaned = cleaned.slice(0, validEndIdx);
  if (cleaned.length === 0) return [];

  const startTime = cleaned[0].session_time || 0;
  const startDist = cleaned[0].lap_distance || 0;

  // Step 3: Normalize time & distance, enforcing strict monotonicity
  const result: TelemetrySamplePoint[] = [];
  let lastDist = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const s = cleaned[i];
    let normDist = (s.lap_distance || 0) - startDist;
    if (normDist < 0) normDist = 0;

    // Enforce strict monotonicity for binary search
    if (normDist <= lastDist) {
      normDist = lastDist + 0.1;
    }
    lastDist = normDist;

    result.push({
      ...s,
      lap_distance: Math.round(normDist * 10) / 10,
      session_time: Math.round((s.session_time - startTime) * 1000) / 1000,
    });
  }

  return result;
}

/**
 * Interpolates value in strictly sorted array of points at distance d
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

  // Binary search for surrounding points
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
 * Computes merged telemetry comparison points over a distance axis.
 */
export function calculateMergedComparison(
  rawA: TelemetrySamplePoint[],
  rawB: TelemetrySamplePoint[],
  stepMeters: number = 5
): MergedTelemetryPoint[] {
  const normA = normalizeTelemetrySeries(rawA);
  const normB = normalizeTelemetrySeries(rawB);

  if (normA.length === 0 && normB.length === 0) return [];

  const maxDistA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
  const maxDistB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;
  const maxDist = Math.max(maxDistA, maxDistB);

  if (maxDist <= 0) return [];

  const result: MergedTelemetryPoint[] = [];

  for (let dist = 0; dist <= maxDist; dist += stepMeters) {
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
