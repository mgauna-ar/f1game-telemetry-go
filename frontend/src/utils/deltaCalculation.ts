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

export function normalizeTelemetrySeries(samples: TelemetrySamplePoint[]): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];
  const startTime = samples[0].session_time;
  const hasValidDistance = samples.some(s => s.lap_distance && s.lap_distance > 0);

  let accumulatedDist = 0;

  return samples.map((s, idx) => {
    let lapDist = s.lap_distance || 0;

    if (!hasValidDistance) {
      if (idx > 0) {
        const dt = s.session_time - samples[idx - 1].session_time;
        if (dt > 0 && dt < 5) {
          const speedMS = (s.speed * 1000) / 3600;
          accumulatedDist += speedMS * dt;
        }
      }
      lapDist = Math.round(accumulatedDist * 10) / 10;
    }

    return {
      ...s,
      lap_distance: Math.round(lapDist * 10) / 10,
      session_time: Math.round((s.session_time - startTime) * 1000) / 1000,
    };
  });
}

/**
 * Interpolates value in sorted array of points at distance d
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
