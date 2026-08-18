export interface TelemetrySamplePoint {
  lap_distance: number;
  session_time: number;
  speed: number;
  throttle: number;
  brake: number;
  steer?: number;
  gear?: number;
  engine_rpm?: number;
  ers_store_energy?: number;
  ers_deploy_mode?: number;
  active_aero_mode?: number;
  active_aero_available?: number;
  overtake_active?: number;
  world_pos_x?: number;
  world_pos_y?: number;
  world_pos_z?: number;
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling in TypeScript.
 */
export function lttbDownsample<T extends TelemetrySamplePoint>(
  data: T[],
  threshold: number
): T[] {
  const len = data.length;
  if (threshold >= len || threshold <= 2) {
    return data;
  }

  const sampled: T[] = [data[0]]; // Always include first point
  const every = (len - 2) / (threshold - 2);

  let a = 0;

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    if (avgRangeEnd > len) {
      avgRangeEnd = len;
    }

    const avgRangeLength = avgRangeEnd - avgRangeStart;
    if (avgRangeLength > 0) {
      for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
        avgX += data[avgRangeStart].lap_distance;
        avgY += data[avgRangeStart].speed;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
    }

    let rangeOffs = Math.floor(i * every) + 1;
    const rangeTo = Math.floor((i + 1) * every) + 1;

    const pointAX = data[a].lap_distance;
    const pointAY = data[a].speed;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (; rangeOffs < rangeTo; rangeOffs++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[rangeOffs].speed - pointAY) -
          (pointAX - data[rangeOffs].lap_distance) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = rangeOffs;
      }
    }

    sampled.push(data[nextA]);
    a = nextA;
  }

  sampled.push(data[len - 1]); // Always include last point
  return sampled;
}
