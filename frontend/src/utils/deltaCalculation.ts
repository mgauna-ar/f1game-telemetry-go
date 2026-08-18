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

interface LapSegment {
  startIdx: number;
  endIdx: number;
  minDist: number;
  maxDist: number;
  span: number;
}

/**
 * Cleans telemetry samples for comparison:
 * - Sanitizes non-finite/NaN values and dropout anomalies
 * - Partitions into contiguous lap segments and isolates the true completed lap attempt
 * - Trims stationary / pre-start countdown freeze samples
 * - Filters isolated distance spike noise
 * - Deduplicates monotonic points for binary search interpolation
 * - Synthesizes / aligns 0m start anchor
 */
export function normalizeTelemetrySeries(
  samples: TelemetrySamplePoint[]
): TelemetrySamplePoint[] {
  if (!samples || samples.length === 0) return [];

  // Step 1: Filter non-finite numbers and uninitialized distance dropouts
  const validSamples = samples.filter(
    (s) =>
      s &&
      typeof s.session_time === 'number' &&
      Number.isFinite(s.session_time) &&
      typeof s.lap_distance === 'number' &&
      Number.isFinite(s.lap_distance) &&
      (s.lap_distance ?? 0) >= 0 &&
      // Drop uninitialized distance dropouts where car is traveling at speed on track
      !((s.lap_distance ?? 0) <= 0.05 && (s.speed ?? 0) > 30 && (s.session_time ?? 0) > 5.0)
  );
  if (validSamples.length < 2) return [];

  const sorted = [...validSamples].sort((a, b) => a.session_time - b.session_time);
  if (sorted.length < 2) return [];

  // Step 2: Partition sorted samples into contiguous monotonically progressing segments
  const segments: LapSegment[] = [];
  let segStart = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevDist = sorted[i - 1].lap_distance || 0;
    const currDist = sorted[i].lap_distance || 0;
    const prevTime = sorted[i - 1].session_time || 0;
    const currTime = sorted[i].session_time || 0;

    // Check if curr is an isolated dropout/glitch
    if ((prevDist - currDist > 200 || currDist < prevDist * 0.35) && i + 1 < sorted.length) {
      const nextDist = sorted[i + 1].lap_distance || 0;
      if (nextDist >= prevDist - 50.0) {
        continue;
      }
    }

    // Reset condition: persistent sudden drop in distance or time reversal
    const isDrop =
      (prevDist > 100 && (currDist < 50 || currDist < prevDist * 0.35)) ||
      prevDist - currDist > 500 ||
      currTime < prevTime;

    if (isDrop) {
      if (i > segStart) {
        let minD = sorted[segStart].lap_distance || 0;
        let maxD = sorted[segStart].lap_distance || 0;
        for (let k = segStart; k < i; k++) {
          const d = sorted[k].lap_distance || 0;
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
        segments.push({
          startIdx: segStart,
          endIdx: i,
          minDist: minD,
          maxDist: maxD,
          span: maxD - minD,
        });
      }
      segStart = i;
    }
  }

  // Add final segment
  if (segStart < sorted.length) {
    let minD = sorted[segStart].lap_distance || 0;
    let maxD = sorted[segStart].lap_distance || 0;
    for (let k = segStart; k < sorted.length; k++) {
      const d = sorted[k].lap_distance || 0;
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    }
    segments.push({
      startIdx: segStart,
      endIdx: sorted.length,
      minDist: minD,
      maxDist: maxD,
      span: maxD - minD,
    });
  }

  if (segments.length === 0) return [];

  // Step 3: Select the best segment representing the completed lap attempt
  let maxSpan = 0;
  for (const seg of segments) {
    if (seg.span > maxSpan) maxSpan = seg.span;
  }

  let bestSegIdx = -1;
  for (let idx = segments.length - 1; idx >= 0; idx--) {
    const seg = segments[idx];
    if (seg.span >= maxSpan * 0.7 && (seg.span > 1000 || seg.span === maxSpan)) {
      bestSegIdx = idx;
      break;
    }
  }
  if (bestSegIdx === -1) {
    for (let idx = 0; idx < segments.length; idx++) {
      if (segments[idx].span === maxSpan) {
        bestSegIdx = idx;
        break;
      }
    }
  }

  const selected = sorted.slice(segments[bestSegIdx].startIdx, segments[bestSegIdx].endIdx);
  if (selected.length < 2) return [];

  // Step 4: Advance past stationary / flat freeze samples at the start
  const minDist = segments[bestSegIdx].minDist;
  let firstMovingIdx = -1;
  for (let i = 0; i < selected.length; i++) {
    if ((selected[i].lap_distance || 0) > minDist + 15.0 || (selected[i].speed || 0) > 10) {
      firstMovingIdx = i;
      break;
    }
  }

  let actualStart = 0;
  if (firstMovingIdx > 0) {
    for (let i = firstMovingIdx - 1; i >= 0; i--) {
      if ((selected[i].lap_distance || 0) <= minDist + 5.0) {
        actualStart = i;
        break;
      }
    }
  }

  const movingSamples = selected.slice(actualStart);
  if (movingSamples.length < 2) return [];

  // Step 5: Deduplicate and filter out isolated distance spike noise
  const deduped: TelemetrySamplePoint[] = [movingSamples[0]];
  for (let i = 1; i < movingSamples.length; i++) {
    const curr = movingSamples[i];
    const prev = deduped[deduped.length - 1];
    const currDist = curr.lap_distance ?? 0;
    const prevDist = prev.lap_distance ?? 0;

    // Check if curr is an isolated distance jump spike
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

  if (deduped.length < 2) return [];

  // Step 6: Calibrate 0m start point & time
  const firstSample = deduped[0];
  const firstDist = firstSample.lap_distance ?? 0;
  let startTime = firstSample.session_time;

  // Only project time offset to zero for flying laps crossing the start line at speed
  // For standing grid starts (e.g. Lap 1 of a race), time starts at firstSample.session_time (t=0)
  if (firstDist > 0 && firstDist <= 25.0) {
    const rawSpeed = Number(firstSample.speed) || 0;
    if (rawSpeed > 30) {
      const speedMS = (rawSpeed * 1000) / 3600;
      const timeOffsetToZero = firstDist / speedMS;
      startTime = firstSample.session_time - timeOffsetToZero;
    }
  }

  const result: TelemetrySamplePoint[] = [];

  // Always synthesize a clean 0.0m anchor if the first sample is not exactly at 0m
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

/**
 * Merges two normalized telemetry series onto a common distance grid.
 */
export function calculateMergedComparison(
  rawA: TelemetrySamplePoint[],
  rawB: TelemetrySamplePoint[],
  stepMeters: number = 5,
  targetTrackLength?: number
): MergedTelemetryPoint[] {
  let normA = normalizeTelemetrySeries(rawA);
  let normB = normalizeTelemetrySeries(rawB);

  if (normA.length === 0 && normB.length === 0) return [];

  if (targetTrackLength && targetTrackLength > 0) {
    const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
    const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;
    if (endA > 0 && Math.abs(endA - targetTrackLength) > 100) {
      const scaleA = targetTrackLength / endA;
      normA = normA.map((s) => ({ ...s, lap_distance: Math.round(s.lap_distance * scaleA * 10) / 10 }));
    }
    if (endB > 0 && Math.abs(endB - targetTrackLength) > 100) {
      const scaleB = targetTrackLength / endB;
      normB = normB.map((s) => ({ ...s, lap_distance: Math.round(s.lap_distance * scaleB * 10) / 10 }));
    }
  }

  const endA = normA.length > 0 ? normA[normA.length - 1].lap_distance : 0;
  const endB = normB.length > 0 ? normB[normB.length - 1].lap_distance : 0;

  const rangeStart = 0;
  let rangeEnd: number;

  if (targetTrackLength && targetTrackLength > 0) {
    rangeEnd = targetTrackLength;
  } else if (normA.length > 0 && normB.length > 0) {
    // Extend across the full lap distance to the finish line
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

    // For 3D world coordinates, prefer whichever series has raw telemetry at this distance
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

  // Fail-safe initial delta offset zeroing: find first non-null delta and calibrate
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


