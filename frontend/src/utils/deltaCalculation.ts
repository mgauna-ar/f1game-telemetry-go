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
  activeAeroA?: number | null;
  activeAeroB?: number | null;
  boostActiveA?: number | null;
  boostActiveB?: number | null;
  worldX?: number | null;
  worldZ?: number | null;
}

export interface NormalizeTelemetryOptions {
  expectedLapTimeMs?: number;
  trackLength?: number;
}

/**
 * Deterministically normalizes telemetry samples for a single lap attempt:
 * - When expectedLapTimeMs is provided (> 0), uses deterministic backward slicing:
 *   t_start = t_end - (expectedLapTimeMs / 1000)
 *   Discards all out-laps, garage samples, and pre-start countdowns with zero threshold guesswork.
 * - Deduplicates monotonic distance points for clean binary search interpolation.
 * - Synthesizes 0.0m start anchor at t_relative = 0.000s.
 * - Scales relative time smoothly from 0.000s to the official lap duration.
 */
export function normalizeTelemetrySeries(
  samples: TelemetrySamplePoint[],
  options?: number | NormalizeTelemetryOptions
): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];

  const expectedLapTimeMs =
    typeof options === 'number'
      ? options
      : options?.expectedLapTimeMs;

  // Step 1: Filter non-finite numbers and valid distance samples
  const validSamples = samples.filter(
    (s) =>
      s &&
      typeof s.session_time === 'number' &&
      Number.isFinite(s.session_time) &&
      typeof s.lap_distance === 'number' &&
      Number.isFinite(s.lap_distance) &&
      s.lap_distance >= 0 &&
      // Filter out isolated uninitialized distance dropouts
      !((s.lap_distance ?? 0) <= 0.05 && (s.speed ?? 0) > 30 && (s.session_time ?? 0) > 5.0)
  );

  if (validSamples.length === 0) return [];

  // Sort chronologically by session_time
  const sorted = [...validSamples].sort((a, b) => a.session_time - b.session_time);
  if (sorted.length === 0) return [];

  // Filter isolated distance jump spikes (1-sample telemetry glitches)
  const cleaned: TelemetrySamplePoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && i + 1 < sorted.length) {
      const prevD = sorted[i - 1].lap_distance ?? 0;
      const currD = sorted[i].lap_distance ?? 0;
      const nextD = sorted[i + 1].lap_distance ?? 0;
      if (currD - prevD > 250 && nextD < currD - 150 && nextD >= prevD - 20) {
        continue;
      }
    }
    cleaned.push(sorted[i]);
  }
  if (cleaned.length === 0) return [];

  let movingSamples: TelemetrySamplePoint[];

  // Deterministic Backward Windowing when expectedLapTimeMs is known
  if (expectedLapTimeMs && expectedLapTimeMs > 0) {
    const lapDurationSec = expectedLapTimeMs / 1000;
    const lastSample = cleaned[cleaned.length - 1];
    const tEnd = lastSample.session_time;
    const tStart = tEnd - lapDurationSec;

    // Slice samples falling within the flying lap window [tStart - 0.25, tEnd + 0.1]
    const lapWindow = cleaned.filter(
      (s) => s.session_time >= tStart - 0.25 && s.session_time <= tEnd + 0.1
    );

    let actualStartIdx = 0;
    for (let i = 0; i < lapWindow.length; i++) {
      if (lapWindow[i].session_time >= tStart - 0.05) {
        actualStartIdx = i;
        break;
      }
    }

    movingSamples = lapWindow.slice(actualStartIdx);
  } else {
    // Fallback for live/uncompleted laps: find largest contiguous distance segment
    let bestStart = 0;
    let bestEnd = cleaned.length;
    let maxDistSpan = 0;
    let curStart = 0;

    for (let i = 1; i < cleaned.length; i++) {
      const prevD = cleaned[i - 1].lap_distance || 0;
      const curD = cleaned[i].lap_distance || 0;
      const prevT = cleaned[i - 1].session_time || 0;
      const curT = cleaned[i].session_time || 0;

      if ((prevD > 20 && curD < 15) || prevD - curD > 30 || curT < prevT) {
        const span = (cleaned[i - 1].lap_distance || 0) - (cleaned[curStart].lap_distance || 0);
        if (span > maxDistSpan) {
          maxDistSpan = span;
          bestStart = curStart;
          bestEnd = i;
        }
        curStart = i;
      }
    }

    const lastSpan = (cleaned[cleaned.length - 1].lap_distance || 0) - (cleaned[curStart].lap_distance || 0);
    if (lastSpan >= maxDistSpan) {
      bestStart = curStart;
      bestEnd = cleaned.length;
    }

    movingSamples = cleaned.slice(bestStart, bestEnd);
  }

  if (movingSamples.length === 0) return [];

  // Deduplicate points so distance is strictly monotonic
  const deduped: TelemetrySamplePoint[] = [movingSamples[0]];
  for (let i = 1; i < movingSamples.length; i++) {
    const curr = movingSamples[i];
    const prev = deduped[deduped.length - 1];
    const currDist = curr.lap_distance ?? 0;
    const prevDist = prev.lap_distance ?? 0;

    // Filter isolated distance jump spikes
    if (currDist - prevDist > 250 && i + 1 < movingSamples.length) {
      const nextDist = movingSamples[i + 1].lap_distance ?? 0;
      if (nextDist < currDist - 150 && nextDist >= prevDist) {
        continue;
      }
    }

    if (currDist > prevDist) {
      deduped.push(curr);
    }
  }

  if (deduped.length === 0) return [];

  // Calibrate start timestamp t=0.000s at 0.0m
  const firstSample = deduped[0];
  const firstDist = firstSample.lap_distance ?? 0;
  let startTime = firstSample.session_time;

  if (firstDist > 0 && firstDist <= 25.0) {
    const rawSpeed = Number(firstSample.speed) || 0;
    if (rawSpeed > 30) {
      const speedMS = (rawSpeed * 1000) / 3600;
      const timeOffsetToZero = firstDist / speedMS;
      startTime = firstSample.session_time - timeOffsetToZero;
    }
  }

  const result: TelemetrySamplePoint[] = [];

  // Synthesize clean 0.0m anchor
  if (firstDist > 0.05) {
    result.push({
      ...firstSample,
      lap_distance: 0,
      session_time: 0,
    });
  }

  for (const s of deduped) {
    const dist = s.lap_distance ?? 0;
    const timeNorm = Math.max(0, s.session_time - startTime);
    result.push({
      ...s,
      lap_distance: Math.round(dist * 10) / 10,
      session_time: Math.round(timeNorm * 1000) / 1000,
    });
  }

  return result;
}

/**
 * Interpolates a value from a strictly-sorted-by-distance array at distance d.
 * Supports smooth boundary clamping for start and finish line continuity.
 */
function interpolateAtDistance(
  samples: TelemetrySamplePoint[],
  key: keyof TelemetrySamplePoint,
  d: number,
  rangeEnd?: number
): number | null {
  if (!samples || samples.length === 0) return null;

  const firstDist = samples[0].lap_distance;
  const lastDist = samples[samples.length - 1].lap_distance;

  // Clamping at start (before first recorded point)
  if (d <= firstDist) {
    if (key === 'session_time') {
      return 0;
    }
    const val = samples[0][key];
    return typeof val === 'number' && Number.isFinite(val) ? val : 0;
  }

  // Clamping at finish line (beyond last recorded point)
  if (d >= lastDist) {
    // If the lap was completed (within 250m of finish or >85% of track), clamp to finish values
    const isNearFinish = !rangeEnd || rangeEnd - lastDist <= 250 || (rangeEnd > 0 && lastDist >= rangeEnd * 0.85);
    if (isNearFinish || d - lastDist <= 100) {
      const val = samples[samples.length - 1][key];
      return typeof val === 'number' && Number.isFinite(val) ? val : 0;
    }
    // Otherwise the lap was aborted/incomplete and stopped short
    return null;
  }

  let low = 0;
  let high = samples.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (samples[mid].lap_distance === d) {
      const val = samples[mid][key];
      return typeof val === 'number' && Number.isFinite(val) ? val : 0;
    }
    if (samples[mid].lap_distance < d) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx1 = Math.max(0, high);
  const idx2 = Math.min(samples.length - 1, low);
  if (idx1 === idx2) {
    const val = samples[idx1][key];
    return typeof val === 'number' && Number.isFinite(val) ? val : 0;
  }

  const d1 = samples[idx1].lap_distance;
  const d2 = samples[idx2].lap_distance;
  const rawV1 = samples[idx1][key];
  const rawV2 = samples[idx2][key];
  const v1 = typeof rawV1 === 'number' && Number.isFinite(rawV1) ? rawV1 : 0;
  const v2 = typeof rawV2 === 'number' && Number.isFinite(rawV2) ? rawV2 : 0;
  if (d2 === d1) return v1;

  const factor = (d - d1) / (d2 - d1);
  const interpolated = v1 + factor * (v2 - v1);
  return Number.isFinite(interpolated) ? interpolated : v1;
}

export interface ComparisonOptions {
  stepMeters?: number;
  targetTrackLength?: number;
  lapTimeMsA?: number;
  lapTimeMsB?: number;
}

/**
 * Merges two normalized telemetry series onto a common distance grid and calculates precise time delta.
 */
export function calculateMergedComparison(
  rawA: TelemetrySamplePoint[],
  rawB: TelemetrySamplePoint[],
  stepMetersOrOptions: number | ComparisonOptions = 5,
  targetTrackLength?: number,
  lapTimeMsA?: number,
  lapTimeMsB?: number
): MergedTelemetryPoint[] {
  let stepMeters = 5;
  let trackLength = targetTrackLength;
  let timeMsA = lapTimeMsA;
  let timeMsB = lapTimeMsB;

  if (typeof stepMetersOrOptions === 'object' && stepMetersOrOptions !== null) {
    stepMeters = stepMetersOrOptions.stepMeters ?? 5;
    trackLength = stepMetersOrOptions.targetTrackLength;
    timeMsA = stepMetersOrOptions.lapTimeMsA;
    timeMsB = stepMetersOrOptions.lapTimeMsB;
  } else if (typeof stepMetersOrOptions === 'number') {
    stepMeters = stepMetersOrOptions;
  }

  let normA = normalizeTelemetrySeries(rawA, timeMsA);
  let normB = normalizeTelemetrySeries(rawB, timeMsB);

  if (normA.length === 0 && normB.length === 0) return [];

  if (trackLength && trackLength > 0) {
    const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
    const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;
    if (endA > 0 && Math.abs(endA - trackLength) > 100) {
      const scaleA = trackLength / endA;
      normA = normA.map((s) => ({ ...s, lap_distance: Math.round(s.lap_distance * scaleA * 10) / 10 }));
    }
    if (endB > 0 && Math.abs(endB - trackLength) > 100) {
      const scaleB = trackLength / endB;
      normB = normB.map((s) => ({ ...s, lap_distance: Math.round(s.lap_distance * scaleB * 10) / 10 }));
    }
  }

  const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
  const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;

  const rangeStart = 0;
  let rangeEnd: number;

  if (trackLength && trackLength > 0) {
    rangeEnd = trackLength;
  } else if (normA.length > 0 && normB.length > 0) {
    rangeEnd = Math.max(endA, endB);
  } else if (normA.length > 0) {
    rangeEnd = endA;
  } else {
    rangeEnd = endB;
  }

  if (rangeEnd <= rangeStart) return [];

  const gridDistances: number[] = [];
  for (let dist = rangeStart; dist <= rangeEnd; dist += stepMeters) {
    gridDistances.push(Math.round(dist * 10) / 10);
  }
  if (gridDistances.length === 0 || gridDistances[gridDistances.length - 1] < rangeEnd) {
    gridDistances.push(Math.round(rangeEnd * 10) / 10);
  }

  const result: MergedTelemetryPoint[] = [];

  for (const dist of gridDistances) {
    const roundedDist = dist;

    const timeA = normA.length > 0 ? interpolateAtDistance(normA, 'session_time', dist, rangeEnd) : null;
    const timeB = normB.length > 0 ? interpolateAtDistance(normB, 'session_time', dist, rangeEnd) : null;
    const timeDelta =
      timeA !== null && timeB !== null && Number.isFinite(timeA) && Number.isFinite(timeB)
        ? Math.round((timeA - timeB) * 1000) / 1000
        : null;

    const speedA = normA.length > 0 ? interpolateAtDistance(normA, 'speed', dist, rangeEnd) : null;
    const speedB = normB.length > 0 ? interpolateAtDistance(normB, 'speed', dist, rangeEnd) : null;
    const speedDelta =
      speedA !== null && speedB !== null && Number.isFinite(speedA) && Number.isFinite(speedB)
        ? Math.round(speedA) - Math.round(speedB)
        : null;

    const throttleA = normA.length > 0 ? interpolateAtDistance(normA, 'throttle', dist, rangeEnd) : null;
    const throttleB = normB.length > 0 ? interpolateAtDistance(normB, 'throttle', dist, rangeEnd) : null;

    const brakeA = normA.length > 0 ? interpolateAtDistance(normA, 'brake', dist, rangeEnd) : null;
    const brakeB = normB.length > 0 ? interpolateAtDistance(normB, 'brake', dist, rangeEnd) : null;

    const steerA = normA.length > 0 ? interpolateAtDistance(normA, 'steer', dist, rangeEnd) : null;
    const steerB = normB.length > 0 ? interpolateAtDistance(normB, 'steer', dist, rangeEnd) : null;

    const gearA = normA.length > 0 ? interpolateAtDistance(normA, 'gear', dist, rangeEnd) : null;
    const gearB = normB.length > 0 ? interpolateAtDistance(normB, 'gear', dist, rangeEnd) : null;

    const ersBatteryA = normA.length > 0 ? interpolateAtDistance(normA, 'ers_store_energy', dist, rangeEnd) : null;
    const ersBatteryB = normB.length > 0 ? interpolateAtDistance(normB, 'ers_store_energy', dist, rangeEnd) : null;

    const ersDeployModeA = normA.length > 0 ? interpolateAtDistance(normA, 'ers_deploy_mode', dist, rangeEnd) : null;
    const ersDeployModeB = normB.length > 0 ? interpolateAtDistance(normB, 'ers_deploy_mode', dist, rangeEnd) : null;

    const activeAeroA = normA.length > 0 ? interpolateAtDistance(normA, 'active_aero_mode', dist, rangeEnd) : null;
    const activeAeroB = normB.length > 0 ? interpolateAtDistance(normB, 'active_aero_mode', dist, rangeEnd) : null;

    const boostActiveA = normA.length > 0 ? interpolateAtDistance(normA, 'overtake_active', dist, rangeEnd) : null;
    const boostActiveB = normB.length > 0 ? interpolateAtDistance(normB, 'overtake_active', dist, rangeEnd) : null;

    const hasRawA = normA.length > 0 && dist >= (normA[0].lap_distance ?? 0);
    const hasRawB = normB.length > 0 && dist >= (normB[0].lap_distance ?? 0);

    let worldX: number | null = null;
    let worldZ: number | null = null;

    if (hasRawA) {
      worldX = interpolateAtDistance(normA, 'world_pos_x', dist, rangeEnd);
      worldZ = interpolateAtDistance(normA, 'world_pos_z', dist, rangeEnd);
    } else if (hasRawB) {
      worldX = interpolateAtDistance(normB, 'world_pos_x', dist, rangeEnd);
      worldZ = interpolateAtDistance(normB, 'world_pos_z', dist, rangeEnd);
    } else if (normA.length > 0) {
      worldX = interpolateAtDistance(normA, 'world_pos_x', dist, rangeEnd);
      worldZ = interpolateAtDistance(normA, 'world_pos_z', dist, rangeEnd);
    } else if (normB.length > 0) {
      worldX = interpolateAtDistance(normB, 'world_pos_x', dist, rangeEnd);
      worldZ = interpolateAtDistance(normB, 'world_pos_z', dist, rangeEnd);
    }

    result.push({
      lap_distance: roundedDist,
      time_delta: timeDelta,
      timeA: timeA !== null && Number.isFinite(timeA) ? Math.round(timeA * 1000) / 1000 : null,
      timeB: timeB !== null && Number.isFinite(timeB) ? Math.round(timeB * 1000) / 1000 : null,
      speedA: speedA !== null && Number.isFinite(speedA) ? Math.round(speedA) : null,
      speedB: speedB !== null && Number.isFinite(speedB) ? Math.round(speedB) : null,
      speed_delta: speedDelta,
      throttleA: throttleA !== null && Number.isFinite(throttleA) ? Math.round(throttleA * 100) / 100 : null,
      throttleB: throttleB !== null && Number.isFinite(throttleB) ? Math.round(throttleB * 100) / 100 : null,
      brakeA: brakeA !== null && Number.isFinite(brakeA) ? Math.round(brakeA * 100) / 100 : null,
      brakeB: brakeB !== null && Number.isFinite(brakeB) ? Math.round(brakeB * 100) / 100 : null,
      steerA: steerA !== null && Number.isFinite(steerA) ? Math.round(steerA * 100) / 100 : null,
      steerB: steerB !== null && Number.isFinite(steerB) ? Math.round(steerB * 100) / 100 : null,
      gearA: gearA !== null && Number.isFinite(gearA) ? Math.round(gearA) : null,
      gearB: gearB !== null && Number.isFinite(gearB) ? Math.round(gearB) : null,
      ersBatteryA: ersBatteryA !== null && Number.isFinite(ersBatteryA) ? Math.round(ersBatteryA * 10) / 10 : null,
      ersBatteryB: ersBatteryB !== null && Number.isFinite(ersBatteryB) ? Math.round(ersBatteryB * 10) / 10 : null,
      ersDeployModeA: ersDeployModeA !== null && Number.isFinite(ersDeployModeA) ? Math.round(ersDeployModeA) : null,
      ersDeployModeB: ersDeployModeB !== null && Number.isFinite(ersDeployModeB) ? Math.round(ersDeployModeB) : null,
      activeAeroA: activeAeroA !== null && Number.isFinite(activeAeroA) ? Math.round(activeAeroA) : null,
      activeAeroB: activeAeroB !== null && Number.isFinite(activeAeroB) ? Math.round(activeAeroB) : null,
      boostActiveA: boostActiveA !== null && Number.isFinite(boostActiveA) ? Math.round(boostActiveA) : null,
      boostActiveB: boostActiveB !== null && Number.isFinite(boostActiveB) ? Math.round(boostActiveB) : null,
      worldX: worldX !== null && Number.isFinite(worldX) ? worldX : undefined,
      worldZ: worldZ !== null && Number.isFinite(worldZ) ? worldZ : undefined,
    });
  }

  // Calibrate initial delta at 0m to 0.000s
  const firstValidPoint = result.find((p) => p.time_delta !== null && typeof p.time_delta === 'number' && Number.isFinite(p.time_delta));
  const firstValidDelta = firstValidPoint?.time_delta;
  if (typeof firstValidDelta === 'number' && Number.isFinite(firstValidDelta) && Math.abs(firstValidDelta) > 0.0001) {
    for (const point of result) {
      if (point.time_delta !== null) {
        point.time_delta = Math.round((point.time_delta - firstValidDelta) * 1000) / 1000;
      }
    }
  }

  return result;
}


