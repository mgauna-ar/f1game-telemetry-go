import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Lap } from '../types/session';
import type { MergedTelemetryPoint, TrackTurn, ComparatorResponse } from '../types/comparator';

export interface UseMergedTelemetryOptions {
  lapAId?: number | '';
  lapBId?: number | '';
  lapAObj?: Lap;
  lapBObj?: Lap;
  stepMeters?: number;
  targetTrackLength?: number;
}

export interface UseMergedTelemetryReturn {
  comparisonData: MergedTelemetryPoint[];
  detectedTurns: TrackTurn[];
  chartData: MergedTelemetryPoint[];
  sector1Distance: number | null;
  sector2Distance: number | null;
  totalDeltaMs: number | null;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
  hoverDistance: number | null;
  setHoverDistance: React.Dispatch<React.SetStateAction<number | null>>;
  zoomDomain: [number, number] | null;
  setZoomDomain: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  handleMouseMove: (state: any) => void;
  loading: boolean;
}

export function useMergedTelemetry({
  lapAId,
  lapBId,
  lapAObj,
  lapBObj,
  stepMeters = 5,
  targetTrackLength,
}: UseMergedTelemetryOptions): UseMergedTelemetryReturn {
  const [comparisonData, setComparisonData] = useState<MergedTelemetryPoint[]>([]);
  const [detectedTurns, setDetectedTurns] = useState<TrackTurn[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  // Fetch merged comparison telemetry from Go backend endpoint with server-side caching
  useEffect(() => {
    if (!lapAId && !lapBId) {
      setComparisonData([]);
      setDetectedTurns([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const params = new URLSearchParams();
    if (lapAId) params.set('lapA', String(lapAId));
    if (lapBId) params.set('lapB', String(lapBId));
    if (stepMeters) params.set('stepMeters', String(stepMeters));
    if (targetTrackLength && targetTrackLength > 0) params.set('targetTrackLength', String(targetTrackLength));

    fetch(`/api/comparator/merge?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: ComparatorResponse) => {
        setComparisonData(data.points || []);
        setDetectedTurns(data.turns || []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch comparator merged telemetry', err);
          setComparisonData([]);
          setDetectedTurns([]);
        }
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [lapAId, lapBId, stepMeters, targetTrackLength]);

  // Filtered telemetry points based on active distance zoom domain
  const chartData = useMemo(() => {
    if (!zoomDomain || comparisonData.length === 0) return comparisonData;
    return comparisonData.filter(
      (p) => p.lap_distance >= zoomDomain[0] && p.lap_distance <= zoomDomain[1]
    );
  }, [comparisonData, zoomDomain]);

  // Sector Split Distances for Track Map and Chart Reference Lines
  const { sector1Distance, sector2Distance } = useMemo(() => {
    if (comparisonData.length === 0) {
      return { sector1Distance: null, sector2Distance: null };
    }

    const maxDist = comparisonData[comparisonData.length - 1].lap_distance || 1;
    const lapObj =
      lapAObj?.sector1_ms && lapAObj?.sector2_ms
        ? lapAObj
        : lapBObj?.sector1_ms && lapBObj?.sector2_ms
        ? lapBObj
        : null;

    let calculatedS1: number | null = null;
    let calculatedS2: number | null = null;

    if (lapObj && lapObj.sector1_ms && lapObj.sector2_ms) {
      const s1Time = lapObj.sector1_ms / 1000;
      const s2Time = (lapObj.sector1_ms + lapObj.sector2_ms) / 1000;
      const useTimeA = lapObj === lapAObj;

      for (const p of comparisonData) {
        const timeVal = useTimeA ? p.timeA : p.timeB;
        if (timeVal !== null && timeVal !== undefined && Number.isFinite(timeVal)) {
          if (calculatedS1 === null && timeVal >= s1Time) {
            calculatedS1 = p.lap_distance;
          }
          if (calculatedS2 === null && timeVal >= s2Time) {
            calculatedS2 = p.lap_distance;
          }
        }
      }
    }

    const s1 =
      calculatedS1 !== null && calculatedS1 > 0 && calculatedS1 < maxDist
        ? calculatedS1
        : Math.round((maxDist / 3) * 10) / 10;
    const s2 =
      calculatedS2 !== null && calculatedS2 > s1 && calculatedS2 < maxDist
        ? calculatedS2
        : Math.round(((maxDist * 2) / 3) * 10) / 10;

    return {
      sector1Distance: s1,
      sector2Distance: s2,
    };
  }, [comparisonData, lapAObj, lapBObj]);

  // Overall time delta calculation (A - B)
  const totalDeltaMs = useMemo(() => {
    if (!lapAObj?.lap_time_ms || !lapBObj?.lap_time_ms) return null;
    return lapAObj.lap_time_ms - lapBObj.lap_time_ms;
  }, [lapAObj, lapBObj]);

  // Sector time deltas (A vs B)
  const s1Delta = useMemo(() => {
    if (lapAObj?.sector1_ms && lapBObj?.sector1_ms) {
      return lapAObj.sector1_ms - lapBObj.sector1_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  const s2Delta = useMemo(() => {
    if (lapAObj?.sector2_ms && lapBObj?.sector2_ms) {
      return lapAObj.sector2_ms - lapBObj.sector2_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  const s3Delta = useMemo(() => {
    if (lapAObj?.sector3_ms && lapBObj?.sector3_ms) {
      return lapAObj.sector3_ms - lapBObj.sector3_ms;
    }
    return null;
  }, [lapAObj, lapBObj]);

  // Recharts hover crosshair handler
  const handleMouseMove = useCallback((state: any) => {
    if (!state) {
      setHoverDistance(null);
      return;
    }

    let dist: number | null = null;
    if (state.activeLabel !== undefined && state.activeLabel !== null) {
      const num = Number(state.activeLabel);
      if (!isNaN(num)) {
        dist = num;
      }
    }

    if (dist === null && state.activePayload && state.activePayload.length > 0) {
      const p = state.activePayload[0]?.payload?.lap_distance;
      if (typeof p === 'number') {
        dist = p;
      }
    }

    setHoverDistance(dist);
  }, []);

  return {
    comparisonData,
    detectedTurns,
    chartData,
    sector1Distance,
    sector2Distance,
    totalDeltaMs,
    s1Delta,
    s2Delta,
    s3Delta,
    hoverDistance,
    setHoverDistance,
    zoomDomain,
    setZoomDomain,
    handleMouseMove,
    loading,
  };
}
