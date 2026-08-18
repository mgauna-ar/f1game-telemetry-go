import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Layers,
  TrendingUp,
  Clock,
  Filter,
  Wrench,
  Award,
  Zap,
} from 'lucide-react';
import { TEAM_COLORS, TYRE_COMPOUNDS, TYRE_COMPOUND_IDS } from '../../constants/f1';
import type { DriverStanding, Lap } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';

interface SessionStintStrategyTabProps {
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
  renderTyreBadge: (compound?: string, actualCompound?: string) => React.ReactNode;
}

export interface DriverStint {
  stintIndex: number;
  stintId: number;
  compound: string;
  actualCompound?: string;
  startLap: number;
  endLap: number;
  totalLaps: number;
  laps: Lap[];
  avgLapTimeMS: number;
  bestLapTimeMS: number;
  hasPitStopAfter: boolean;
}

export interface DriverStintData {
  driver: DriverStanding;
  stints: DriverStint[];
  strategyString: string;
  totalStints: number;
  totalPits: number;
}

const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.92)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.8rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
  },
  itemStyle: {
    padding: '2px 0',
    fontSize: '0.75rem',
  },
  labelStyle: {
    color: '#cbd5e1',
    fontWeight: 700,
    marginBottom: '4px',
  },
};

const getCompoundColor = (compound?: string): string => {
  if (!compound) return '#A0A0A0';
  const str = compound.toUpperCase().trim();
  if (str === String(TYRE_COMPOUND_IDS.INTERMEDIATE) || str.includes('INTER') || str === 'I') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.INTERMEDIATE]?.color || '#33cc66';
  }
  if (str === String(TYRE_COMPOUND_IDS.SOFT) || str.includes('SOFT') || str === 'S') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.SOFT]?.color || '#ff3366';
  }
  if (str === String(TYRE_COMPOUND_IDS.MEDIUM) || str.includes('MEDIUM') || str === 'MED' || str === 'M') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.MEDIUM]?.color || '#ffd700';
  }
  if (str === String(TYRE_COMPOUND_IDS.HARD) || str.includes('HARD') || str === 'H') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.HARD]?.color || '#ffffff';
  }
  if (str === String(TYRE_COMPOUND_IDS.WET) || str.includes('WET') || str === 'W') {
    return TYRE_COMPOUNDS[TYRE_COMPOUND_IDS.WET]?.color || '#3399ff';
  }
  return '#A0A0A0';
};

const normalizeCompoundName = (raw?: string): string => {
  if (!raw) return 'UNKNOWN';
  const str = raw.toUpperCase().trim();
  if (str === String(TYRE_COMPOUND_IDS.INTERMEDIATE) || str.includes('INTER') || str === 'I') return 'INTERMEDIATE';
  if (str === String(TYRE_COMPOUND_IDS.SOFT) || str.includes('SOFT') || str === 'S') return 'SOFT';
  if (str === String(TYRE_COMPOUND_IDS.MEDIUM) || str.includes('MEDIUM') || str === 'MED' || str === 'M') return 'MEDIUM';
  if (str === String(TYRE_COMPOUND_IDS.HARD) || str.includes('HARD') || str === 'H') return 'HARD';
  if (str === String(TYRE_COMPOUND_IDS.WET) || str.includes('WET') || str === 'W') return 'WET';
  return str;
};

// Helper: Simple Linear Regression for degradation rate (slope: ms per lap)
const calculateDegradationSlope = (dataPoints: Array<{ age: number; timeSec: number }>): number | null => {
  if (dataPoints.length < 3) return null;
  const n = dataPoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const pt of dataPoints) {
    sumX += pt.age;
    sumY += pt.timeSec;
    sumXY += pt.age * pt.timeSec;
    sumXX += pt.age * pt.age;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  return slope;
};

export const SessionStintStrategyTab: React.FC<SessionStintStrategyTabProps> = ({
  driverStandings,
  totalSessionLaps,
  formatLapTime,
}) => {
  const { t } = useI18n();

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

  // Outlier filter toggle
  const [filterOutliers, setFilterOutliers] = useState<boolean>(true);

  // Hovered stint in Gantt timeline
  const [hoveredStint, setHoveredStint] = useState<{
    driverIndex: number;
    stintIndex: number;
  } | null>(null);

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

  // Find fastest valid lap time in session to establish outlier ceiling
  const sessionBestLapMS = useMemo(() => {
    let best = Infinity;
    driverStandings.forEach((d) => {
      if (d.bestLapTimeMS > 0 && d.bestLapTimeMS < best) {
        best = d.bestLapTimeMS;
      }
    });
    return best < Infinity ? best : 90000;
  }, [driverStandings]);

  const outlierThresholdMS = sessionBestLapMS * 1.18; // > 118% of session best is considered slow/in/out lap

  // 1. Process all drivers and extract complete Stint structures
  const driverStintsData: DriverStintData[] = useMemo(() => {
    return driverStandings.map((driver) => {
      const sortedLaps = [...driver.laps].sort((a, b) => a.lap_number - b.lap_number);
      const rawStints: DriverStint[] = [];
      let currentStint: DriverStint | null = null;

      sortedLaps.forEach((lap) => {
        const rawComp = lap.tyre_compound || 'UNKNOWN';
        const normComp = normalizeCompoundName(rawComp);
        const lapStintId = lap.stint && lap.stint > 0 ? lap.stint : 0;

        const isNewStint =
          !currentStint ||
          (lapStintId > 0 && currentStint.stintId > 0 && lapStintId !== currentStint.stintId) ||
          currentStint.compound !== normComp;

        if (isNewStint || !currentStint) {
          if (currentStint) {
            currentStint.hasPitStopAfter = true;
          }
          currentStint = {
            stintIndex: rawStints.length + 1,
            stintId: lapStintId,
            compound: normComp,
            actualCompound: lap.actual_compound,
            startLap: lap.lap_number,
            endLap: lap.lap_number,
            totalLaps: 1,
            laps: [lap],
            avgLapTimeMS: lap.lap_time_ms > 0 ? lap.lap_time_ms : 0,
            bestLapTimeMS: lap.lap_time_ms > 0 ? lap.lap_time_ms : 0,
            hasPitStopAfter: false,
          };
          rawStints.push(currentStint);
        } else {
          currentStint.endLap = lap.lap_number;
          currentStint.totalLaps += 1;
          currentStint.laps.push(lap);
          if (!currentStint.actualCompound && lap.actual_compound) {
            currentStint.actualCompound = lap.actual_compound;
          }
        }
      });

      // Calculate averages and bests per stint
      rawStints.forEach((s) => {
        const validLaps = s.laps.filter((l) => l.lap_time_ms > 0);
        if (validLaps.length > 0) {
          const sum = validLaps.reduce((acc, l) => acc + l.lap_time_ms, 0);
          s.avgLapTimeMS = Math.round(sum / validLaps.length);
          s.bestLapTimeMS = Math.min(...validLaps.map((l) => l.lap_time_ms));
        }
      });

      const strategyString =
        rawStints.length > 0
          ? rawStints.map((s) => `${s.compound.charAt(0)} (${s.totalLaps}L)`).join(' ➔ ')
          : 'N/A';

      const totalPits = Math.max(0, rawStints.length - 1);

      return {
        driver,
        stints: rawStints,
        strategyString,
        totalStints: rawStints.length,
        totalPits,
      };
    });
  }, [driverStandings]);

  // Determine effective maximum lap count for Gantt width scaling
  const effectiveMaxLaps = useMemo(() => {
    if (totalSessionLaps > 0) return totalSessionLaps;
    let maxLap = 1;
    driverStintsData.forEach((d) => {
      d.stints.forEach((s) => {
        if (s.endLap > maxLap) maxLap = s.endLap;
      });
    });
    return maxLap;
  }, [totalSessionLaps, driverStintsData]);

  // 2. Summary KPI Metrics
  const strategyKPIs = useMemo(() => {
    if (driverStintsData.length === 0) {
      return {
        mostPopularStrategy: 'N/A',
        mostPopularCount: 0,
        longestStintDriver: null as { driver: DriverStanding; stint: DriverStint } | null,
        bestLapsByCompound: {} as Record<string, { timeMS: number; driverName: string }>,
        totalFieldPitStops: 0,
      };
    }

    // A. Most popular strategy pattern (e.g. M ➔ H)
    const strategyCounts: Record<string, number> = {};
    let totalPitsSum = 0;
    driverStintsData.forEach((d) => {
      if (d.stints.length > 0) {
        const pattern = d.stints.map((s) => s.compound.charAt(0)).join(' ➔ ');
        strategyCounts[pattern] = (strategyCounts[pattern] || 0) + 1;
        totalPitsSum += d.totalPits;
      }
    });

    let topStrategy = 'N/A';
    let topCount = 0;
    Object.entries(strategyCounts).forEach(([strat, count]) => {
      if (count > topCount) {
        topStrategy = strat;
        topCount = count;
      }
    });

    // B. Longest single stint
    let longestStint: { driver: DriverStanding; stint: DriverStint } | null = null;
    driverStintsData.forEach((d) => {
      d.stints.forEach((s) => {
        if (!longestStint || s.totalLaps > longestStint.stint.totalLaps) {
          longestStint = { driver: d.driver, stint: s };
        }
      });
    });

    // C. Best lap by compound
    const bestLaps: Record<string, { timeMS: number; driverName: string }> = {};
    driverStintsData.forEach((d) => {
      d.stints.forEach((s) => {
        s.laps.forEach((l) => {
          if (l.lap_time_ms > 0 && l.is_valid) {
            const comp = s.compound;
            if (!bestLaps[comp] || l.lap_time_ms < bestLaps[comp].timeMS) {
              bestLaps[comp] = {
                timeMS: l.lap_time_ms,
                driverName: d.driver.participant.name,
              };
            }
          }
        });
      });
    });

    return {
      mostPopularStrategy: topStrategy,
      mostPopularCount: topCount,
      longestStintDriver: longestStint,
      bestLapsByCompound: bestLaps,
      totalFieldPitStops: totalPitsSum,
    };
  }, [driverStintsData]);

  // 3. Prepare Tyre Degradation & Pace Curves Data (Plotted by Tyre Age)
  const { degradationData, maxTyreAge, degradationRates } = useMemo(() => {
    // Collect all active drivers
    const activeDrivers = driverStintsData.filter((d) => selectedDrivers[d.driver.participant.car_index]);

    let globalMaxAge = 0;
    // Map: tyreAge -> { tyreAge, [driverKey]: lapTimeSec }
    const ageDataMap: Record<number, { tyreAge: number; [key: string]: any }> = {};
    const driverPointSeries: Record<string, Array<{ age: number; timeSec: number }>> = {};

    activeDrivers.forEach((d) => {
      const carIdx = d.driver.participant.car_index;

      d.stints.forEach((stint) => {
        // Filter by compound if not 'ALL'
        if (selectedCompound !== 'ALL' && stint.compound !== selectedCompound) {
          return;
        }

        stint.laps.forEach((lap, lapIndexInStint) => {
          const tyreAge = lapIndexInStint + 1; // 1-indexed tyre age
          if (tyreAge > globalMaxAge) {
            globalMaxAge = tyreAge;
          }

          if (lap.lap_time_ms > 0) {
            // Outlier check
            if (!filterOutliers || lap.lap_time_ms <= outlierThresholdMS) {
              const sec = parseFloat((lap.lap_time_ms / 1000).toFixed(3));
              const key = `driver_${carIdx}_stint_${stint.stintIndex}`;

              if (!ageDataMap[tyreAge]) {
                ageDataMap[tyreAge] = { tyreAge };
              }
              ageDataMap[tyreAge][key] = sec;
              ageDataMap[tyreAge][`${key}_compound`] = stint.compound;
              ageDataMap[tyreAge][`${key}_rawMS`] = lap.lap_time_ms;
              ageDataMap[tyreAge][`${key}_lapNum`] = lap.lap_number;

              if (!driverPointSeries[key]) {
                driverPointSeries[key] = [];
              }
              driverPointSeries[key].push({ age: tyreAge, timeSec: sec });
            }
          }
        });
      });
    });

    const dataArray: Array<{ tyreAge: number; [key: string]: any }> = [];
    for (let age = 1; age <= globalMaxAge; age++) {
      dataArray.push(ageDataMap[age] || { tyreAge: age });
    }

    // Compute degradation slope rates
    const rates: Record<string, number | null> = {};
    Object.entries(driverPointSeries).forEach(([key, points]) => {
      rates[key] = calculateDegradationSlope(points);
    });

    return {
      degradationData: dataArray,
      maxTyreAge: globalMaxAge,
      degradationRates: rates,
    };
  }, [driverStintsData, selectedDrivers, selectedCompound, filterOutliers, outlierThresholdMS]);

  // Unique compounds used in this session for filter pills
  const sessionCompounds = useMemo(() => {
    const set = new Set<string>();
    driverStintsData.forEach((d) => {
      d.stints.forEach((s) => {
        if (s.compound && s.compound !== 'UNKNOWN') {
          set.add(s.compound);
        }
      });
    });
    return Array.from(set);
  }, [driverStintsData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. TOP STRATEGY KPI SUMMARY CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Most Popular Strategy */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              {t('history.stints.kpi.mostPopularStrategy').toUpperCase()}
            </span>
            <Layers size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>
            {strategyKPIs.mostPopularStrategy}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {strategyKPIs.mostPopularCount > 0
              ? t('history.detail.driversCount', { count: strategyKPIs.mostPopularCount })
              : t('history.stints.kpi.noStints')}
          </div>
        </div>

        {/* Longest Stint */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              {t('history.stints.kpi.longestStint').toUpperCase()}
            </span>
            <Clock size={16} color="#ffd700" />
          </div>
          {strategyKPIs.longestStintDriver ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                <TyreCompoundBadge compound={strategyKPIs.longestStintDriver.stint.compound} />
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                  {t('history.detail.lapsCount', { count: strategyKPIs.longestStintDriver.stint.totalLaps })}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {strategyKPIs.longestStintDriver.driver.participant.name} (#{strategyKPIs.longestStintDriver.driver.participant.race_number})
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('history.stints.kpi.noStints')}</div>
          )}
        </div>

        {/* Total Pit Stops */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              {t('history.stints.kpi.totalPitStops').toUpperCase()}
            </span>
            <Wrench size={16} color="#ff3366" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>
            {t('history.stints.kpi.stopsCount', { count: strategyKPIs.totalFieldPitStops })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {(strategyKPIs.totalFieldPitStops / Math.max(driverStandings.length, 1)).toFixed(1)} avg stops / car
          </div>
        </div>

        {/* Fastest Compound Laps */}
        <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              {t('history.stints.kpi.bestCompoundLaps').toUpperCase()}
            </span>
            <Zap size={16} color="#a855f7" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {Object.keys(strategyKPIs.bestLapsByCompound).length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('history.stints.kpi.noStints')}</span>
            ) : (
              Object.entries(strategyKPIs.bestLapsByCompound).map(([comp, item]) => (
                <div
                  key={comp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    fontSize: '0.72rem',
                  }}
                  title={`${comp}: ${formatLapTime(item.timeMS)} (${item.driverName})`}
                >
                  <TyreCompoundBadge compound={comp} />
                  <span className="mono" style={{ color: getCompoundColor(comp), fontWeight: 700 }}>
                    {formatLapTime(item.timeMS)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. FIELD TYRE STRATEGY GANTT TIMELINE */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <Layers size={18} color="var(--accent-primary)" />
              {t('history.stints.timeline.title')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {t('history.stints.timeline.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff3366' }} /> Soft
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffd700' }} /> Medium
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffffff' }} /> Hard
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#33cc66' }} /> Inter
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3399ff' }} /> Wet
            </span>
          </div>
        </div>

        {/* Gantt Timeline Container */}
        {driverStintsData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            {t('history.stints.kpi.noStintsDesc')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ minWidth: '760px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Lap Ruler Header */}
              <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '180px', marginBottom: '4px' }}>
                <div style={{ position: 'relative', width: '100%', height: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const lapVal = Math.max(1, Math.round(pct * effectiveMaxLaps));
                    return (
                      <span
                        key={pct}
                        className="mono"
                        style={{
                          position: 'absolute',
                          left: `${pct * 100}%`,
                          transform: pct === 1 ? 'translateX(-100%)' : pct === 0 ? 'none' : 'translateX(-50%)',
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        L{lapVal}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Driver Stint Rows */}
              {driverStintsData.map((d, dIdx) => {
                const teamColor = TEAM_COLORS[d.driver.participant.team_id] || '#A0A0A0';
                const isSelected = !!selectedDrivers[d.driver.participant.car_index];

                return (
                  <div
                    key={d.driver.participant.car_index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      borderLeft: `3px solid ${teamColor}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Driver Identity Cell */}
                    <div
                      style={{
                        width: '172px',
                        minWidth: '172px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleDriver(d.driver.participant.car_index)}
                      title={t('history.stints.timeline.clickToFilter')}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: d.driver.position === 1 ? '#ffd700' : 'var(--text-muted)',
                          width: '24px',
                        }}
                      >
                        P{d.driver.position}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '105px',
                        }}
                      >
                        {d.driver.participant.name}
                      </span>
                      <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        #{d.driver.participant.race_number}
                      </span>
                    </div>

                    {/* Stint Bars Track Area */}
                    <div
                      style={{
                        flex: 1,
                        position: 'relative',
                        height: '24px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {d.stints.map((stint, sIdx) => {
                        const startPct = Math.max(0, ((stint.startLap - 1) / effectiveMaxLaps) * 100);
                        const endPct = Math.min(100, (stint.endLap / effectiveMaxLaps) * 100);
                        const widthPct = Math.max(2, endPct - startPct);
                        const compColor = getCompoundColor(stint.compound);
                        const isHovered = hoveredStint?.driverIndex === dIdx && hoveredStint?.stintIndex === sIdx;

                        return (
                          <div
                            key={sIdx}
                            onMouseEnter={() => setHoveredStint({ driverIndex: dIdx, stintIndex: sIdx })}
                            onMouseLeave={() => setHoveredStint(null)}
                            onClick={() => toggleDriver(d.driver.participant.car_index)}
                            style={{
                              position: 'absolute',
                              left: `${startPct}%`,
                              width: `${widthPct}%`,
                              height: '100%',
                              backgroundColor: `${compColor}26`,
                              border: `1px solid ${compColor}88`,
                              borderRight: stint.hasPitStopAfter ? `2px dashed #ff4757` : `1px solid ${compColor}88`,
                              borderRadius: sIdx === 0 ? '4px 0 0 4px' : sIdx === d.stints.length - 1 ? '0 4px 4px 0' : '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0 4px',
                              cursor: 'pointer',
                              zIndex: isHovered ? 10 : 1,
                              transform: isHovered ? 'scaleY(1.12)' : 'scaleY(1)',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                              boxShadow: isHovered ? `0 0 10px ${compColor}88` : 'none',
                            }}
                            title={`Stint ${stint.stintIndex}: ${stint.compound} (Laps ${stint.startLap} - ${stint.endLap}, ${stint.totalLaps}L) | Avg: ${formatLapTime(stint.avgLapTimeMS)}`}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <TyreCompoundBadge compound={stint.compound} />
                              {widthPct > 6 && (
                                <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 700, color: compColor }}>
                                  {stint.totalLaps}L
                                </span>
                              )}
                            </span>

                            {stint.hasPitStopAfter && (
                              <span title={`Pit stop on lap ${stint.endLap}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <Wrench size={10} color="#ff4757" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3. TYRE DEGRADATION & PACE CURVES CHART */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header & Controls Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <TrendingUp size={18} color="var(--accent-secondary)" />
              {t('history.stints.degradation.title')}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {t('history.stints.degradation.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Compound Filter Pills */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                className={`nav-tab ${selectedCompound === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedCompound('ALL')}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              >
                {t('history.stints.degradation.allCompounds')}
              </button>
              {sessionCompounds.map((comp) => {
                const color = getCompoundColor(comp);
                const isActive = selectedCompound === comp;
                return (
                  <button
                    key={comp}
                    onClick={() => setSelectedCompound(comp)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                      backgroundColor: isActive ? `${color}33` : 'rgba(0,0,0,0.3)',
                      color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <TyreCompoundBadge compound={comp} />
                    <span>{comp}</span>
                  </button>
                );
              })}
            </div>

            {/* Outlier Filter Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={filterOutliers}
                onChange={(e) => setFilterOutliers(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <span>{t('history.stints.degradation.filterOutliers')}</span>
            </label>
          </div>
        </div>

        {/* Driver Selection Filter Chips */}
        <div style={{ padding: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} /> {t('history.stints.degradation.filterDrivers')}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={selectAllDrivers}
                className="nav-tab"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              >
                {t('history.stints.degradation.selectAll')}
              </button>
              <button
                onClick={clearAllDrivers}
                className="nav-tab"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              >
                {t('history.stints.degradation.clear')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {driverStandings.map((driver) => {
              const isSelected = !!selectedDrivers[driver.participant.car_index];
              const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';

              return (
                <button
                  key={driver.participant.car_index}
                  onClick={() => toggleDriver(driver.participant.car_index)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: '16px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${isSelected ? teamColor : 'rgba(255,255,255,0.1)'}`,
                    background: isSelected ? `${teamColor}22` : 'rgba(0,0,0,0.3)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: teamColor }} />
                  <span>{driver.participant.name}</span>
                  <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                    #{driver.participant.race_number}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Degradation Rate Slopes Summary Chips */}
        {Object.keys(degradationRates).length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Award size={13} /> {t('history.stints.degradation.degRate')}:
            </span>
            {Object.entries(degradationRates).map(([key, slope]) => {
              if (slope === null) return null;
              const [, carIdxStr, , stintIdxStr] = key.split('_');
              const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
              const teamColor = driver ? TEAM_COLORS[driver.participant.team_id] || '#00f2fe' : '#00f2fe';
              const isDegrading = slope > 0;
              const slopeFormatted = Math.abs(slope).toFixed(3);

              return (
                <div
                  key={key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${teamColor}66`,
                    fontSize: '0.7rem',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: teamColor }} />
                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{driver?.participant.name || `Car #${carIdxStr}`}</span>
                  <span style={{ color: 'var(--text-muted)' }}>S{stintIdxStr}:</span>
                  <span className="mono" style={{ color: isDegrading ? '#ff6b6b' : '#51cf66', fontWeight: 700 }}>
                    {isDegrading ? `+${slopeFormatted}s/lap` : `-${slopeFormatted}s/lap`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Degradation Chart Container */}
        {degradationData.length === 0 || maxTyreAge === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
            {t('history.stints.degradation.noDegradationData')}
          </div>
        ) : (
          <div style={{ width: '100%', height: '420px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={degradationData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="tyreAge"
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(val) => `Age ${val}`}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `${val.toFixed(1)}s`}
                />
                <Tooltip
                  {...compactTooltipProps}
                  labelFormatter={(age) => `${t('history.stints.degradation.tyreAgeAxis')}: ${age} Laps`}
                  formatter={(val: any, name: any, item: any) => {
                    const key = String(name);
                    const rawMS = item.payload[`${key}_rawMS`];
                    const comp = item.payload[`${key}_compound`];
                    const lapNum = item.payload[`${key}_lapNum`];
                    const timeStr = rawMS ? formatLapTime(rawMS) : `${val}s`;

                    const [, carIdxStr, , stintIdxStr] = key.split('_');
                    const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
                    const label = `${driver?.participant.name || 'Driver'} (Stint ${stintIdxStr} • ${comp || 'Tyre'} • Race L${lapNum})`;
                    return [timeStr, label];
                  }}
                />
                <Legend />

                {/* Render a line for each driver stint */}
                {driverStintsData
                  .filter((d) => selectedDrivers[d.driver.participant.car_index])
                  .flatMap((d) => {
                    const carIdx = d.driver.participant.car_index;
                    const teamColor = TEAM_COLORS[d.driver.participant.team_id] || '#00f2fe';

                    return d.stints
                      .filter((s) => selectedCompound === 'ALL' || s.compound === selectedCompound)
                      .map((stint) => {
                        const key = `driver_${carIdx}_stint_${stint.stintIndex}`;
                        const lineName = `${d.driver.participant.name} (S${stint.stintIndex} ${stint.compound.charAt(0)})`;

                        return (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={lineName}
                            stroke={teamColor}
                            strokeWidth={2}
                            strokeDasharray={stint.stintIndex > 1 ? '4 4' : undefined}
                            dot={{ r: 3, fill: getCompoundColor(stint.compound) }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        );
                      });
                  })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
