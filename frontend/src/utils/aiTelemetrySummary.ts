import type { MergedTelemetryPoint } from './deltaCalculation';
import { detectTrackTurns, type TrackTurn } from './trackTurns';
import { formatLapTime, formatSectorTime } from './formatters';

export interface LapInfo {
  id: number;
  lap_number: number;
  lap_time_ms: number;
  sector1_ms?: number;
  sector2_ms?: number;
  sector3_ms?: number;
  is_valid: boolean;
  tyre_compound?: string;
}

export interface TelemetryContextPayload {
  track_name: string;
  session_type: string;
  session_b_type?: string;
  weather_a?: string;
  weather_b?: string;
  cross_session?: boolean;
  lap_a_name: string;
  lap_b_name: string;
  lap_a_time_formatted: string;
  lap_b_time_formatted: string;
  time_delta_seconds: number;
  faster_lap: string;
  lap_a_compound: string;
  lap_b_compound: string;
  lap_a_s1_formatted: string;
  lap_b_s1_formatted: string;
  lap_a_s2_formatted: string;
  lap_b_s2_formatted: string;
  lap_a_s3_formatted: string;
  lap_b_s3_formatted: string;
  top_speed_a: number;
  top_speed_b: number;
  ers_a_used_percent: number;
  ers_b_used_percent: number;
  braking_summary?: string;
  apex_speed_summary?: string;
  throttle_summary?: string;
  ers_drs_summary?: string;
  zoomed_range?: {
    start_distance_meters: number;
    end_distance_meters: number;
    description?: string;
    delta_in_segment: number;
    speed_diff_at_apex: number;
    braking_diff_meters: number;
  };
}

/**
 * Computes telemetry summaries and heuristics to pass to the AI Race Engineer.
 */
export function buildTelemetryContext(
  trackName: string,
  sessionType: string,
  lapA: LapInfo | undefined,
  lapB: LapInfo | undefined,
  nameA: string,
  nameB: string,
  comparisonData: MergedTelemetryPoint[],
  zoomDomain: [number, number] | null,
  sessionTypeB?: string,
  weatherA?: string,
  weatherB?: string
): TelemetryContextPayload | null {
  if (!lapA || !lapB || comparisonData.length === 0) {
    return null;
  }

  const deltaTotalSec = (lapA.lap_time_ms - lapB.lap_time_ms) / 1000;
  const fasterLap = deltaTotalSec < 0 ? `Lap A (${nameA})` : `Lap B (${nameB})`;

  let topSpeedA = 0;
  let topSpeedB = 0;
  let ersDeployCountA = 0;
  let ersDeployCountB = 0;

  for (const pt of comparisonData) {
    if (pt.speedA !== null && pt.speedA > topSpeedA) topSpeedA = pt.speedA;
    if (pt.speedB !== null && pt.speedB > topSpeedB) topSpeedB = pt.speedB;
    if (pt.ersDeployModeA !== null && pt.ersDeployModeA > 0) ersDeployCountA++;
    if (pt.ersDeployModeB !== null && pt.ersDeployModeB > 0) ersDeployCountB++;
  }

  const ersAUsedPercent = comparisonData.length > 0 ? (ersDeployCountA / comparisonData.length) * 100 : 0;
  const ersBUsedPercent = comparisonData.length > 0 ? (ersDeployCountB / comparisonData.length) * 100 : 0;

  // Heuristic Braking & Apex Speed analysis
  // Find major braking zones (where brake > 40%)
  const brakingZones: { dist: number; brakeA: number; brakeB: number; speedMinA: number; speedMinB: number }[] = [];
  let inBraking = false;
  let currentZoneDist = 0;
  let maxBrkA = 0;
  let maxBrkB = 0;
  let minSpdA = 999;
  let minSpdB = 999;

  for (let i = 0; i < comparisonData.length; i++) {
    const pt = comparisonData[i];
    const isBraking = (pt.brakeA ?? 0) > 40 || (pt.brakeB ?? 0) > 40;

    if (isBraking) {
      if (!inBraking) {
        inBraking = true;
        currentZoneDist = pt.lap_distance;
        maxBrkA = pt.brakeA ?? 0;
        maxBrkB = pt.brakeB ?? 0;
        minSpdA = pt.speedA ?? 999;
        minSpdB = pt.speedB ?? 999;
      } else {
        if ((pt.brakeA ?? 0) > maxBrkA) maxBrkA = pt.brakeA ?? 0;
        if ((pt.brakeB ?? 0) > maxBrkB) maxBrkB = pt.brakeB ?? 0;
        if (pt.speedA !== null && pt.speedA < minSpdA) minSpdA = pt.speedA;
        if (pt.speedB !== null && pt.speedB < minSpdB) minSpdB = pt.speedB;
      }
    } else if (inBraking) {
      inBraking = false;
      if (maxBrkA > 50 || maxBrkB > 50) {
        brakingZones.push({
          dist: Math.round(currentZoneDist),
          brakeA: maxBrkA,
          brakeB: maxBrkB,
          speedMinA: minSpdA < 900 ? minSpdA : 0,
          speedMinB: minSpdB < 900 ? minSpdB : 0,
        });
      }
    }
  }

  // Track turns detection
  const detectedTurns = detectTrackTurns(comparisonData);
  const getTurnLabel = (dist: number): string => {
    let closestTurn: TrackTurn | null = null;
    let minDist = 130;
    for (const turn of detectedTurns) {
      const diff = Math.abs(turn.distance - dist);
      if (diff < minDist) {
        minDist = diff;
        closestTurn = turn;
      }
    }
    return closestTurn ? `${closestTurn.name} (~${dist}m)` : `${dist}m`;
  };

  let brakingSummary = '';
  let apexSpeedSummary = '';
  if (brakingZones.length > 0) {
    const keyZones = brakingZones.slice(0, 5);
    brakingSummary = `Detected ${brakingZones.length} heavy braking zones. Examples at: ` +
      keyZones.map((z) => `${getTurnLabel(z.dist)} (Peak: A=${z.brakeA}% vs B=${z.brakeB}%)`).join(', ');

    apexSpeedSummary = keyZones
      .filter((z) => z.speedMinA > 0 && z.speedMinB > 0)
      .map((z) => `At ${getTurnLabel(z.dist)}: min speed A=${z.speedMinA.toFixed(0)} km/h vs B=${z.speedMinB.toFixed(0)} km/h`)
      .join('; ');
  }

  const throttleSummary = `Top speed reached: A=${topSpeedA.toFixed(1)} km/h vs B=${topSpeedB.toFixed(1)} km/h. Top speed delta: ${(topSpeedA - topSpeedB).toFixed(1)} km/h.`;
  const ersDrsSummary = `Active ERS deployment: A=${ersAUsedPercent.toFixed(1)}% vs B=${ersBUsedPercent.toFixed(1)}% of lap distance.`;

  let zoomedRange: TelemetryContextPayload['zoomed_range'] | undefined;
  if (zoomDomain && zoomDomain[1] > zoomDomain[0]) {
    const startM = zoomDomain[0];
    const endM = zoomDomain[1];
    const ptsInZoom = comparisonData.filter((p) => p.lap_distance >= startM && p.lap_distance <= endM);

    if (ptsInZoom.length >= 1) {
      const firstPt = ptsInZoom[0];
      const lastPt = ptsInZoom[ptsInZoom.length - 1];

      const startDelta = (firstPt.timeA !== null && firstPt.timeB !== null) ? firstPt.timeA - firstPt.timeB : 0;
      const endDelta = (lastPt.timeA !== null && lastPt.timeB !== null) ? lastPt.timeA - lastPt.timeB : startDelta;
      const deltaInSegment = endDelta - startDelta;

      let minSpdZoomA = 999;
      let minSpdZoomB = 999;
      for (const p of ptsInZoom) {
        if (p.speedA !== null && p.speedA < minSpdZoomA) minSpdZoomA = p.speedA;
        if (p.speedB !== null && p.speedB < minSpdZoomB) minSpdZoomB = p.speedB;
      }
      const speedDiffAtApex = (minSpdZoomA < 900 && minSpdZoomB < 900) ? minSpdZoomA - minSpdZoomB : 0;

      // Find any turns within zoom range
      const turnsInZoom = detectedTurns
        .filter((t) => t.distance >= startM && t.distance <= endM)
        .map((t) => t.name);

      const zoomDesc = turnsInZoom.length > 0
        ? `Sector with ${turnsInZoom.join(', ')} (${Math.round(startM)}m to ${Math.round(endM)}m)`
        : `Specific sector from ${Math.round(startM)}m to ${Math.round(endM)}m`;

      zoomedRange = {
        start_distance_meters: Math.round(startM),
        end_distance_meters: Math.round(endM),
        description: zoomDesc,
        delta_in_segment: deltaInSegment,
        speed_diff_at_apex: speedDiffAtApex,
        braking_diff_meters: 0,
      };
    }
  }

  const isCrossSession = Boolean(sessionTypeB && sessionTypeB !== sessionType);

  return {
    track_name: trackName || 'F1 Circuit',
    session_type: sessionType || 'Session',
    session_b_type: sessionTypeB || sessionType || 'Session',
    weather_a: weatherA,
    weather_b: weatherB,
    cross_session: isCrossSession || Boolean(weatherA && weatherB && weatherA !== weatherB),
    lap_a_name: `${nameA} (Lap ${lapA.lap_number})`,
    lap_b_name: `${nameB} (Lap ${lapB.lap_number})`,
    lap_a_time_formatted: formatLapTime(lapA.lap_time_ms),
    lap_b_time_formatted: formatLapTime(lapB.lap_time_ms),
    time_delta_seconds: deltaTotalSec,
    faster_lap: fasterLap,
    lap_a_compound: lapA.tyre_compound || 'Unknown',
    lap_b_compound: lapB.tyre_compound || 'Unknown',
    lap_a_s1_formatted: formatSectorTime(lapA.sector1_ms),
    lap_b_s1_formatted: formatSectorTime(lapB.sector1_ms),
    lap_a_s2_formatted: formatSectorTime(lapA.sector2_ms),
    lap_b_s2_formatted: formatSectorTime(lapB.sector2_ms),
    lap_a_s3_formatted: formatSectorTime(lapA.sector3_ms),
    lap_b_s3_formatted: formatSectorTime(lapB.sector3_ms),
    top_speed_a: topSpeedA,
    top_speed_b: topSpeedB,
    ers_a_used_percent: ersAUsedPercent,
    ers_b_used_percent: ersBUsedPercent,
    braking_summary: brakingSummary,
    apex_speed_summary: apexSpeedSummary,
    throttle_summary: throttleSummary,
    ers_drs_summary: ersDrsSummary,
    zoomed_range: zoomedRange,
  };
}
