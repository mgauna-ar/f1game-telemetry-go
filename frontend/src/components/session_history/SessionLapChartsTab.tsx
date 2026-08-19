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
import { TrendingUp, Award, Layers, Filter, Activity, Clock } from 'lucide-react';
import { TEAM_COLORS } from '../../constants/f1';
import type { DriverStanding } from '../../types/session';
import { useI18n } from '../../context/I18nContext';

interface SessionLapChartsTabProps {
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
}

const compactTooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(10, 14, 23, 0.85)',
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

export const SessionLapChartsTab: React.FC<SessionLapChartsTabProps> = ({
  driverStandings,
  totalSessionLaps,
  formatLapTime,
}) => {
  const { t } = useI18n();
  const [activeChart, setActiveChart] = useState<'pace' | 'position' | 'gap'>('pace');

  // Selected driver car_indices for visibility (default to top 5)
  const [selectedDrivers, setSelectedDrivers] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    driverStandings.slice(0, 5).forEach((d) => {
      initial[d.participant.car_index] = true;
    });
    return initial;
  });

  const toggleDriver = (carIndex: number) => {
    setSelectedDrivers((prev) => ({
      ...prev,
      [carIndex]: !prev[carIndex],
    }));
  };


  const selectAll = () => {
    const next: Record<number, boolean> = {};
    driverStandings.forEach((d) => {
      next[d.participant.car_index] = true;
    });
    setSelectedDrivers(next);
  };

  const clearAll = () => {
    setSelectedDrivers({});
  };

  const activeDriverStandings = driverStandings.filter((d) => selectedDrivers[d.participant.car_index]);

  // 1. Build Lap Progression Data (always includes all recorded laps)
  const lapProgressionData = useMemo(() => {
    if (totalSessionLaps === 0 || driverStandings.length === 0) return [];

    const data: Array<{ lapNumber: number; [key: string]: any }> = [];

    for (let lapNum = 1; lapNum <= totalSessionLaps; lapNum++) {
      const point: { lapNumber: number; [key: string]: any } = { lapNumber: lapNum };

      driverStandings.forEach((driver) => {
        const carIdx = driver.participant.car_index;
        const lap = driver.laps.find((l) => l.lap_number === lapNum);

        if (lap && lap.lap_time_ms > 0) {
          // Convert to seconds for cleaner chart scales
          point[`driver_${carIdx}`] = parseFloat((lap.lap_time_ms / 1000).toFixed(3));
          point[`driver_${carIdx}_tyre`] = lap.tyre_compound;
          point[`driver_${carIdx}_rawMS`] = lap.lap_time_ms;
        }
      });

      data.push(point);
    }

    return data;
  }, [driverStandings, totalSessionLaps]);

  // 2. Build Position Progression Data
  const positionProgressionData = useMemo(() => {
    if (totalSessionLaps === 0 || driverStandings.length === 0) return [];

    const data: Array<{ lapNumber: number; [key: string]: any }> = [];

    for (let lapNum = 1; lapNum <= totalSessionLaps; lapNum++) {
      const point: { lapNumber: number; [key: string]: any } = { lapNumber: lapNum };

      // Calculate cumulative race time up to this lap for each driver
      const driverTimes: Array<{ carIdx: number; cumulativeMS: number; hasLap: boolean; pos?: number }> = [];

      driverStandings.forEach((driver) => {
        const lapsUpTo = driver.laps.filter((l) => l.lap_number <= lapNum && l.lap_time_ms > 0);
        const hasCurrentLap = driver.laps.some((l) => l.lap_number === lapNum && l.lap_time_ms > 0);
        const totalMS = lapsUpTo.reduce((sum, l) => sum + l.lap_time_ms, 0);

        // Check if car_position is available on lap
        const currentLap = driver.laps.find((l) => l.lap_number === lapNum);
        const directPos = currentLap?.car_position;

        driverTimes.push({
          carIdx: driver.participant.car_index,
          cumulativeMS: totalMS,
          hasLap: hasCurrentLap,
          pos: directPos && directPos > 0 ? directPos : undefined,
        });
      });

      // Sort by cumulative time if direct pos not present
      const sorted = [...driverTimes]
        .filter((d) => d.hasLap)
        .sort((a, b) => {
          if (a.pos && b.pos) return a.pos - b.pos;
          return a.cumulativeMS - b.cumulativeMS;
        });

      sorted.forEach((item, index) => {
        point[`driver_${item.carIdx}`] = item.pos || index + 1;
      });

      data.push(point);
    }

    return data;
  }, [driverStandings, totalSessionLaps]);

  // 3. Build Gap to Leader Data
  const gapToLeaderData = useMemo(() => {
    if (totalSessionLaps === 0 || driverStandings.length === 0) return [];

    const data: Array<{ lapNumber: number; [key: string]: any }> = [];

    for (let lapNum = 1; lapNum <= totalSessionLaps; lapNum++) {
      const point: { lapNumber: number; [key: string]: any } = { lapNumber: lapNum };

      // Cumulative time for leader
      const leader = driverStandings[0];
      const leaderLapsUpTo = leader ? leader.laps.filter((l) => l.lap_number <= lapNum && l.lap_time_ms > 0) : [];
      const leaderCumMS = leaderLapsUpTo.reduce((sum, l) => sum + l.lap_time_ms, 0);

      driverStandings.forEach((driver) => {
        const carIdx = driver.participant.car_index;
        const driverLapsUpTo = driver.laps.filter((l) => l.lap_number <= lapNum && l.lap_time_ms > 0);
        const hasCurrentLap = driver.laps.some((l) => l.lap_number === lapNum && l.lap_time_ms > 0);

        if (hasCurrentLap && driverLapsUpTo.length === lapNum && leaderCumMS > 0) {
          const driverCumMS = driverLapsUpTo.reduce((sum, l) => sum + l.lap_time_ms, 0);
          const gapSec = Math.max(0, (driverCumMS - leaderCumMS) / 1000);
          point[`driver_${carIdx}`] = parseFloat(gapSec.toFixed(3));
        }
      });

      data.push(point);
    }

    return data;
  }, [driverStandings, totalSessionLaps]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Chart Selector Sub-bar */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`nav-tab ${activeChart === 'pace' ? 'active' : ''}`}
            onClick={() => setActiveChart('pace')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Activity size={15} />
            <span>{t('history.progression.pacePace')}</span>
          </button>
          <button
            className={`nav-tab ${activeChart === 'position' ? 'active' : ''}`}
            onClick={() => setActiveChart('position')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <TrendingUp size={15} />
            <span>{t('history.progression.pacePosition')}</span>
          </button>
          <button
            className={`nav-tab ${activeChart === 'gap' ? 'active' : ''}`}
            onClick={() => setActiveChart('gap')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Clock size={15} />
            <span>{t('history.progression.paceGap')}</span>
          </button>
        </div>
      </div>

      {/* Driver Visibility Filter Chips */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} /> {t('history.progression.filterDrivers')} ({activeDriverStandings.length}/{driverStandings.length} {t('history.progression.visible')})
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={selectAll}
              className="nav-tab"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              {t('history.progression.selectAll')}
            </button>
            <button
              onClick={clearAll}
              className="nav-tab"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              {t('history.progression.clear')}
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
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? teamColor : 'rgba(255,255,255,0.1)'}`,
                  background: isSelected ? `${teamColor}22` : 'rgba(0,0,0,0.3)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: teamColor }} />
                <span>{driver.participant.name}</span>
                <span className="mono" style={{ fontSize: '0.68rem', opacity: 0.8 }}>
                  #{driver.participant.race_number}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Chart Area */}
      <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '480px' }}>
        {activeDriverStandings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            {t('history.progression.selectDriverPrompt')}
          </div>
        ) : totalSessionLaps === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            {t('history.progression.noLapProgression')}
          </div>
        ) : (
          <div>
            {/* 1. PACE PROGRESSION CHART */}
            {activeChart === 'pace' && (
              <div>
                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="var(--accent-primary)" />
                  {t('history.progression.lapByLapPace')}
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lapProgressionData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="lapNumber"
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickFormatter={(val) => `L${val}`}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `${val.toFixed(1)}s`}
                      />
                      <Tooltip
                        {...compactTooltipProps}
                        labelFormatter={(lap) => `Lap ${lap}`}
                        formatter={(val: any, name: any, item: any) => {
                          const dataKey = String(item?.dataKey || name);
                          const driverIdx = dataKey.replace('driver_', '');
                          const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                          const rawMS = item?.payload ? item.payload[`driver_${driverIdx}_rawMS`] : undefined;
                          const tyre = item?.payload ? item.payload[`driver_${driverIdx}_tyre`] : undefined;
                          const timeStr = rawMS ? formatLapTime(rawMS) : `${val}s`;
                          return [`${timeStr} (${tyre || 'Tyre'})`, driver?.participant.name || name];
                        }}
                      />
                      <Legend />
                      {activeDriverStandings.map((driver) => {
                        const teamColor = TEAM_COLORS[driver.participant.team_id] || '#00f2fe';
                        return (
                          <Line
                            key={driver.participant.car_index}
                            type="monotone"
                            dataKey={`driver_${driver.participant.car_index}`}
                            name={driver.participant.name}
                            stroke={teamColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: teamColor }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 2. POSITION PROGRESSION CHART */}
            {activeChart === 'position' && (
              <div>
                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--accent-secondary)" />
                  {t('history.progression.positionProgression', { count: driverStandings.length })}
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={positionProgressionData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="lapNumber"
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickFormatter={(val) => `L${val}`}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        reversed
                        domain={[1, Math.max(driverStandings.length, 10)]}
                        tickFormatter={(val) => `P${val}`}
                      />
                      <Tooltip
                        {...compactTooltipProps}
                        labelFormatter={(lap) => `Lap ${lap}`}
                        formatter={(val: any, name: any) => {
                          const driverIdx = String(name).replace('driver_', '');
                          const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                          return [`P${val}`, driver?.participant.name || name];
                        }}
                      />
                      <Legend />
                      {activeDriverStandings.map((driver) => {
                        const teamColor = TEAM_COLORS[driver.participant.team_id] || '#00f2fe';
                        return (
                          <Line
                            key={driver.participant.car_index}
                            type="stepAfter"
                            dataKey={`driver_${driver.participant.car_index}`}
                            name={driver.participant.name}
                            stroke={teamColor}
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: teamColor }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 3. GAP TO LEADER EVOLUTION */}
            {activeChart === 'gap' && (
              <div>
                <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="var(--accent-tertiary)" />
                  {t('history.progression.gapToLeaderDelta')}
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gapToLeaderData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="lapNumber"
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickFormatter={(val) => `L${val}`}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        domain={[0, 'auto']}
                        tickFormatter={(val) => `+${val.toFixed(1)}s`}
                      />
                      <Tooltip
                        {...compactTooltipProps}
                        labelFormatter={(lap) => `Lap ${lap}`}
                        formatter={(val: any, name: any) => {
                          const driverIdx = String(name).replace('driver_', '');
                          const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                          return [`+${Number(val).toFixed(3)}s`, driver?.participant.name || name];
                        }}
                      />
                      <Legend />
                      {activeDriverStandings.map((driver) => {
                        const teamColor = TEAM_COLORS[driver.participant.team_id] || '#00f2fe';
                        return (
                          <Line
                            key={driver.participant.car_index}
                            type="monotone"
                            dataKey={`driver_${driver.participant.car_index}`}
                            name={driver.participant.name}
                            stroke={teamColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: teamColor }}
                            activeDot={{ r: 6 }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
