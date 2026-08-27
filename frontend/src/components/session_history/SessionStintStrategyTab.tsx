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
import type { DriverStanding, Lap, StintsResponse } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';

interface SessionStintStrategyTabProps {
  stintsData?: StintsResponse | null;
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
  degSlopeSecPerLap?: number | null;
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

export const SessionStintStrategyTab: React.FC<SessionStintStrategyTabProps> = ({
  stintsData,
  driverStandings,
  totalSessionLaps,
  formatLapTime,
  renderTyreBadge: _renderTyreBadge,
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

  // 1. Process server-computed Stint structures with driverStandings metadata
  const driverStintsData: DriverStintData[] = useMemo(() => {
    if (!stintsData?.drivers) return [];

    return stintsData.drivers.map((d) => {
      const standing =
        driverStandings.find((ds) => ds.participant.car_index === d.car_index) || {
          position: d.position,
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
  }, [stintsData, driverStandings]);

  // Effective maximum lap count for Gantt width scaling
  const effectiveMaxLaps = stintsData?.effective_max_laps || totalSessionLaps || 1;

  // 2. Summary KPI Metrics directly from server
  const strategyKPIs = useMemo(() => {
    if (!stintsData?.kpis) {
      return {
        mostPopularStrategy: 'N/A',
        mostPopularCount: 0,
        longestStintDriver: null as { driver: DriverStanding; stint: DriverStint } | null,
        bestLapsByCompound: {} as Record<string, { timeMS: number; driverName: string }>,
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
        degradationData: [] as Array<{ tyreAge: number; [key: string]: any }>,
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
                    const key = String(item?.dataKey || name);
                    const rawMS = item?.payload ? item.payload[`${key}_rawMS`] : undefined;
                    const comp = item?.payload ? item.payload[`${key}_compound`] : undefined;
                    const lapNum = item?.payload ? item.payload[`${key}_lapNum`] : undefined;
                    const timeStr = rawMS ? formatLapTime(rawMS) : `${val}s`;

                    const [, carIdxStr, , stintIdxStr] = key.split('_');
                    const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
                    const driverName = driver?.participant.name || (typeof name === 'string' ? name.split(' ')[0] : 'Driver');
                    const label = `${driverName} (Stint ${stintIdxStr || '1'} • ${comp || 'Tyre'} • Race L${lapNum ?? '?'})`;
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
