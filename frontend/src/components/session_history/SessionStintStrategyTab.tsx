import React, { useState, useMemo } from 'react';
import type { DriverStanding, DriverStint, StintsResponse } from '../../types/session';
import { StrategyKPICards, type StrategyKPIs } from './stints/StrategyKPICards';
import { StintGanttTimeline } from './stints/StintGanttTimeline';
import { DegradationCurves } from './stints/DegradationCurves';
import type { DriverStintData } from './stints/stintUtils';

export type { DriverStint, DriverStintData };

interface SessionStintStrategyTabProps {
  stintsData?: StintsResponse | null;
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
  renderTyreBadge?: (compound?: string, actualCompound?: string) => React.ReactNode;
}

export const SessionStintStrategyTab: React.FC<SessionStintStrategyTabProps> = ({
  stintsData,
  driverStandings,
  totalSessionLaps,
  formatLapTime,
}) => {
  // Driver selection for degradation curves (default to top 5)
  const [selectedDrivers, setSelectedDrivers] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    driverStandings.slice(0, 5).forEach((d) => {
      initial[d.participant.car_index] = true;
    });
    return initial;
  });

  // Compound filter for degradation curves ('ALL' or specific compound)
  const [selectedCompound, setSelectedCompound] = useState<string>('ALL');

  const toggleDriver = (carIndex: number) => {
    setSelectedDrivers((prev) => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
  };

  const selectAllDrivers = () => {
    const next: Record<number, boolean> = {};
    driverStandings.forEach((d) => {
      next[d.participant.car_index] = true;
    });
    setSelectedDrivers(next);
  };

  const clearAllDrivers = () => {
    setSelectedDrivers({});
  };

  // 1. Process server-computed Stint structures with driverStandings metadata
  const driverStintsData: DriverStintData[] = useMemo(() => {
    if (!stintsData?.drivers) return [];

    const mapped = stintsData.drivers.map((d) => {
      const standing =
        driverStandings.find((ds) => ds.participant.car_index === d.car_index) || {
          position: d.position,
          carIndex: d.car_index,
          driverName: d.driver_name,
          teamName: '',
          teamId: d.team_id,
          raceNumber: d.race_number,
          participant: {
            id: d.car_index,
            session_id: 0,
            car_index: d.car_index,
            name: d.driver_name,
            driver_id: 0,
            team_id: d.team_id,
            race_number: d.race_number,
            ai_controlled: false,
          },
          laps: [],
          bestLap: null,
          bestLapTimeMS: 0,
          isDNF: false,
          isDSQ: false,
          maxSpeed: 0,
          bestS1MS: 0,
          bestS2MS: 0,
          bestS3MS: 0,
        };

      return {
        driver: standing,
        stints: d.stints.map((s) => ({
          stintIndex: s.stint_index,
          stintId: s.stint_id,
          compound: s.compound,
          actualCompound: s.actual_compound,
          startLap: s.start_lap,
          endLap: s.end_lap,
          totalLaps: s.total_laps,
          laps: s.laps || [],
          avgLapTimeMS: s.avg_lap_time_ms,
          bestLapTimeMS: s.best_lap_time_ms,
          hasPitStopAfter: s.has_pit_stop_after,
          degSlopeSecPerLap: s.deg_slope_sec_per_lap ?? null,
        })),
        strategyString: d.strategy_string,
        totalStints: d.total_stints,
        totalPits: d.total_pits,
      };
    });

    mapped.sort((a, b) => {
      const posA = a.driver.position || 999;
      const posB = b.driver.position || 999;
      if (posA !== posB) return posA - posB;
      return (a.driver.participant.car_index ?? 0) - (b.driver.participant.car_index ?? 0);
    });

    return mapped;
  }, [stintsData, driverStandings]);

  // Effective maximum lap count for Gantt width scaling
  const effectiveMaxLaps = stintsData?.effective_max_laps || totalSessionLaps || 1;

  // 2. Summary KPI Metrics directly from server
  const strategyKPIs: StrategyKPIs = useMemo(() => {
    if (!stintsData?.kpis) {
      return {
        mostPopularStrategy: 'N/A',
        mostPopularCount: 0,
        longestStintDriver: null,
        bestLapsByCompound: {},
        totalFieldPitStops: 0,
      };
    }

    let longestStint: { driver: DriverStanding; stint: DriverStint } | null = null;
    if (stintsData.kpis.longest_stint) {
      const dMatch = driverStintsData.find(
        (d) => d.driver.participant.car_index === stintsData.kpis.longest_stint!.car_index
      );
      const sMatch = dMatch?.stints.find(
        (s) => s.totalLaps === stintsData.kpis.longest_stint!.total_laps
      );
      if (dMatch && sMatch) {
        longestStint = { driver: dMatch.driver, stint: sMatch };
      } else if (dMatch && dMatch.stints.length > 0) {
        longestStint = { driver: dMatch.driver, stint: dMatch.stints[0] };
      }
    }

    const bestLaps: Record<string, { timeMS: number; driverName: string }> = {};
    Object.entries(stintsData.kpis.best_laps_by_compound || {}).forEach(([comp, best]) => {
      bestLaps[comp] = {
        timeMS: best.time_ms,
        driverName: best.driver_name,
      };
    });

    return {
      mostPopularStrategy: stintsData.kpis.most_popular_strategy || 'N/A',
      mostPopularCount: stintsData.kpis.most_popular_count || 0,
      longestStintDriver: longestStint,
      bestLapsByCompound: bestLaps,
      totalFieldPitStops: stintsData.kpis.total_field_pit_stops || 0,
    };
  }, [stintsData, driverStintsData]);

  // 3. Degradation & Pace Curves Data directly from server
  const { degradationData, maxTyreAge, degradationRates } = useMemo(() => {
    if (!stintsData) {
      return {
        degradationData: [] as Array<{ tyreAge: number; [key: string]: number | string | null | undefined }>,
        maxTyreAge: 0,
        degradationRates: {} as Record<string, number | null>,
      };
    }

    return {
      degradationData: stintsData.degradation_data || [],
      maxTyreAge: stintsData.max_tyre_age || 0,
      degradationRates: stintsData.degradation_rates || {},
    };
  }, [stintsData]);

  // Unique compounds used in this session for filter pills
  const sessionCompounds = stintsData?.session_compounds || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. TOP STRATEGY KPI SUMMARY CARDS */}
      <StrategyKPICards
        strategyKPIs={strategyKPIs}
        driverStandings={driverStandings}
        formatLapTime={formatLapTime}
      />

      {/* 2. FIELD TYRE STRATEGY GANTT TIMELINE */}
      <StintGanttTimeline
        driverStintsData={driverStintsData}
        selectedDrivers={selectedDrivers}
        toggleDriver={toggleDriver}
        effectiveMaxLaps={effectiveMaxLaps}
        formatLapTime={formatLapTime}
      />

      {/* 3. TYRE DEGRADATION & PACE CURVES CHART */}
      <DegradationCurves
        degradationData={degradationData}
        maxTyreAge={maxTyreAge}
        degradationRates={degradationRates}
        driverStintsData={driverStintsData}
        driverStandings={driverStandings}
        selectedDrivers={selectedDrivers}
        toggleDriver={toggleDriver}
        selectAllDrivers={selectAllDrivers}
        clearAllDrivers={clearAllDrivers}
        selectedCompound={selectedCompound}
        setSelectedCompound={setSelectedCompound}
        sessionCompounds={sessionCompounds}
        formatLapTime={formatLapTime}
      />
    </div>
  );
};
