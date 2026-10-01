import React, { useState, useMemo } from 'react';
import {
  placeholderParticipant,
  type DriverStanding,
  type DriverStint,
  type StintsResponse,
} from '../../types/session';
import { StrategyKPICards, type StrategyKPIs } from './stints/StrategyKPICards';
import { StintGanttTimeline } from './stints/StintGanttTimeline';
import { DegradationCurves } from './stints/DegradationCurves';
import { stintKey, stintKeysOf, type DriverStintData } from './stints/stintUtils';
import { defaultChartSelection } from '../../utils/player';
import styles from './SessionStintStrategyTab.module.css';

export type { DriverStint, DriverStintData };

interface SessionStintStrategyTabProps {
  stintsData?: StintsResponse | null;
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
  renderTyreBadge?: (compound?: string, actualCompound?: string) => React.ReactNode;
  /** Your car: picked by default with the cars around it, and marked in the driver chips. */
  playerCarIndex?: number | null;
}

export const SessionStintStrategyTab: React.FC<SessionStintStrategyTabProps> = ({
  stintsData,
  driverStandings,
  totalSessionLaps,
  formatLapTime,
  playerCarIndex = null,
}) => {
  // Compound filter for degradation curves ('ALL' or specific compound)
  const [selectedCompound, setSelectedCompound] = useState<string>('ALL');

  // 1. Process server-computed Stint structures with driverStandings metadata
  const driverStintsData: DriverStintData[] = useMemo(() => {
    if (!stintsData?.drivers) return [];

    const mapped = stintsData.drivers.map((d) => {
      const standing = driverStandings.find((ds) => ds.participant.car_index === d.car_index) || {
        position: d.position,
        carIndex: d.car_index,
        driverName: d.driver_name,
        teamName: '',
        teamId: d.team_id,
        raceNumber: d.race_number,
        participant: placeholderParticipant({
          id: d.car_index,
          car_index: d.car_index,
          name: d.driver_name,
          team_id: d.team_id,
          race_number: d.race_number,
        }),
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
          avgLapTimeMS: s.avg_lap_time_ms,
          bestLapTimeMS: s.best_lap_time_ms,
          hasPitStopAfter: s.has_pit_stop_after,
          degSlopeSecPerLap: s.deg_slope_sec_per_lap ?? null,
          fitLaps: s.fit_laps ?? 0,
          excludedLaps: s.excluded_laps ?? [],
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

  // The stints on the degradation chart: at first every stint of you and the cars around you, or
  // of the top 5. Picked per stint in the degradation table; a driver button in the timeline
  // toggles all of that driver's stints.
  const [selectedStints, setSelectedStints] = useState<Record<string, boolean>>(() => {
    const drivers = defaultChartSelection(driverStandings, playerCarIndex);
    return stintKeysOf(driverStintsData, (car) => !!drivers[car]);
  });

  const selectedDrivers = useMemo(() => {
    const selected: Record<number, boolean> = {};
    for (const d of driverStintsData) {
      const car = d.driver.participant.car_index;
      selected[car] = d.stints.some((s) => selectedStints[stintKey(car, s.stintIndex)]);
    }
    return selected;
  }, [driverStintsData, selectedStints]);

  const toggleStint = (key: string) => setSelectedStints((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleDriver = (carIndex: number) => {
    const keys = stintKeysOf(driverStintsData, (car) => car === carIndex);
    const on = !selectedDrivers[carIndex];
    setSelectedStints((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(keys)) next[key] = on;
      return next;
    });
  };

  const hasPlayerStints =
    playerCarIndex !== null && driverStintsData.some((d) => d.driver.participant.car_index === playerCarIndex);

  // Effective maximum lap count for Gantt width scaling
  const effectiveMaxLaps = stintsData?.effective_max_laps || totalSessionLaps || 1;

  // 2. Summary KPI Metrics directly from server
  const strategyKPIs: StrategyKPIs = useMemo(() => {
    if (!stintsData?.kpis) {
      return {
        mostPopularStrategy: '—',
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
      const sMatch = dMatch?.stints.find((s) => s.totalLaps === stintsData.kpis.longest_stint!.total_laps);
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
      mostPopularStrategy: stintsData.kpis.most_popular_strategy || '—',
      mostPopularCount: stintsData.kpis.most_popular_count || 0,
      longestStintDriver: longestStint,
      bestLapsByCompound: bestLaps,
      totalFieldPitStops: stintsData.kpis.total_field_pit_stops || 0,
    };
  }, [stintsData, driverStintsData]);

  // 3. Degradation & Pace Curves Data directly from server
  const degradationData = stintsData?.degradation_data ?? [];
  const maxTyreAge = stintsData?.max_tyre_age ?? 0;

  // Unique compounds used in this session for filter pills
  const sessionCompounds = stintsData?.session_compounds || [];

  return (
    <div className={styles.tab}>
      {/* 1. TOP STRATEGY KPI SUMMARY CARDS */}
      <StrategyKPICards strategyKPIs={strategyKPIs} driverStandings={driverStandings} formatLapTime={formatLapTime} />

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
        driverStintsData={driverStintsData}
        selectedStints={selectedStints}
        toggleStint={toggleStint}
        selectAllStints={() => setSelectedStints(stintKeysOf(driverStintsData, () => true))}
        selectOnlyYours={
          hasPlayerStints
            ? () => setSelectedStints(stintKeysOf(driverStintsData, (car) => car === playerCarIndex))
            : null
        }
        clearStints={() => setSelectedStints({})}
        playerCarIndex={playerCarIndex}
        selectedCompound={selectedCompound}
        setSelectedCompound={setSelectedCompound}
        sessionCompounds={sessionCompounds}
        formatLapTime={formatLapTime}
      />
    </div>
  );
};
