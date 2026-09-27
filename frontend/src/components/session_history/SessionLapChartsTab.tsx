import React, { useId, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award, Layers, Activity, Clock } from 'lucide-react';
import { getTeamColor } from '../../constants/f1';
import { cssVar } from '../../styles/theme';
import { compactTooltipProps } from './stints/stintUtils';
import { DriverFilterChips } from './DriverFilterChips';
import type { DriverStanding, ProgressionResponse } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { cx } from '../ui/cx';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { TabPanel, Tabs } from '../ui/Tabs';
import styles from './SessionLapChartsTab.module.css';

type ChartKind = 'pace' | 'position' | 'gap';

interface SessionLapChartsTabProps {
  progressionData?: ProgressionResponse | null;
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
  isRaceSession?: boolean;
}

export const SessionLapChartsTab: React.FC<SessionLapChartsTabProps> = ({
  progressionData,
  driverStandings,
  totalSessionLaps,
  formatLapTime,
  isRaceSession: _isRaceSession = true,
}) => {
  const { t } = useI18n();
  const [activeChart, setActiveChart] = useState<ChartKind>('pace');
  const tabsId = useId();

  const [filterPitLaps, setFilterPitLaps] = useState<boolean>(true);

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

  // Direct consumption of server-computed progression matrices
  const rawLapProgressionData = progressionData?.lap_pace;
  const positionProgressionData = progressionData?.positions || [];
  const gapToLeaderData = progressionData?.gap_to_leader || [];

  const filteredLapProgressionData = React.useMemo(() => {
    if (!rawLapProgressionData) return [];
    if (!filterPitLaps) return rawLapProgressionData;
    return rawLapProgressionData.map((row) => {
      const filteredRow = { ...row };
      activeDriverStandings.forEach((driver) => {
        const carIdx = driver.participant.car_index;
        const isOutlier = !!row[`driver_${carIdx}_is_outlier`];
        if (isOutlier) {
          filteredRow[`driver_${carIdx}`] = null;
        }
      });
      return filteredRow;
    });
  }, [rawLapProgressionData, filterPitLaps, activeDriverStandings]);

  return (
    <div className={styles.tab}>
      {/* Chart selector */}
      <Panel as="div" padding="compact">
        <Tabs
          idPrefix={tabsId}
          aria-label={t('history.progression.chartTabsLabel')}
          value={activeChart}
          onChange={setActiveChart}
          items={[
            { id: 'pace', label: t('history.progression.pacePace'), icon: <Activity size={15} /> },
            { id: 'position', label: t('history.progression.pacePosition'), icon: <TrendingUp size={15} /> },
            { id: 'gap', label: t('history.progression.paceGap'), icon: <Clock size={15} /> },
          ]}
        />
      </Panel>

      {/* Driver visibility filter chips */}
      <Panel as="div" padding="compact">
        <DriverFilterChips
          label={`${t('history.progression.filterDrivers')} (${activeDriverStandings.length}/${driverStandings.length} ${t('history.progression.visible')})`}
          drivers={driverStandings}
          selected={selectedDrivers}
          onToggle={toggleDriver}
          onSelectAll={selectAll}
          onClear={clearAll}
          selectAllLabel={t('history.progression.selectAll')}
          clearLabel={t('history.progression.clear')}
        />
      </Panel>

      {/* Main interactive chart area */}
      <TabPanel idPrefix={tabsId} tab={activeChart}>
        <Panel as="div" className={styles.chartPanel}>
          {activeDriverStandings.length === 0 ? (
            <EmptyState title={t('history.progression.selectDriverPrompt')} />
          ) : totalSessionLaps === 0 ? (
            <EmptyState title={t('history.progression.noLapProgression')} />
          ) : (
            <div>
              {/* 1. PACE PROGRESSION CHART */}
              {activeChart === 'pace' && (
                <div>
                  <div className={styles.chartHead}>
                    <h4 className={styles.chartTitle}>
                      <TrendingUp size={18} color="var(--accent-primary)" aria-hidden="true" />
                      {t('history.progression.lapByLapPace')}
                    </h4>
                    <label className={styles.pitFilter} title={t('history.progression.filterPitLapsDesc')}>
                      <input
                        type="checkbox"
                        data-testid="filter-pit-laps-checkbox"
                        checked={filterPitLaps}
                        onChange={(e) => setFilterPitLaps(e.target.checked)}
                      />
                      <span>{t('history.progression.filterPitLaps')}</span>
                    </label>
                  </div>
                  <div className={styles.chart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={filteredLapProgressionData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
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
                          filterNull={false}
                          labelFormatter={(lap) => `Lap ${lap}`}
                          formatter={(val, name, item) => {
                            const dataKey = String(item?.dataKey || name);
                            const driverIdx = dataKey.replace('driver_', '');
                            const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                            const payload = item?.payload as Record<string, unknown> | undefined;
                            const rawMS = payload
                              ? (payload[`driver_${driverIdx}_rawMS`] as number | undefined)
                              : undefined;
                            const tyre = payload
                              ? (payload[`driver_${driverIdx}_tyre`] as string | undefined)
                              : undefined;
                            const isOutlier = payload
                              ? (payload[`driver_${driverIdx}_is_outlier`] as boolean | undefined)
                              : false;
                            const outlierReason = payload
                              ? (payload[`driver_${driverIdx}_outlier_reason`] as string | undefined)
                              : undefined;

                            let reasonLabel = '';
                            if (isOutlier) {
                              if (outlierReason === 'pit_in') {
                                reasonLabel = ` • ${t('history.progression.pitIn')}`;
                              } else if (outlierReason === 'pit_out') {
                                reasonLabel = ` • ${t('history.progression.pitOut')}`;
                              } else if (outlierReason === 'slow') {
                                reasonLabel = ` • ${t('history.progression.slowLap')}`;
                              } else {
                                reasonLabel = ` • ${t('history.progression.pitStop')}`;
                              }
                            }

                            const timeStr = rawMS
                              ? formatLapTime(rawMS)
                              : val !== null && val !== undefined
                                ? `${val}s`
                                : '-';
                            return [
                              `${timeStr} (${tyre || 'Tyre'}${reasonLabel})`,
                              driver?.participant.name || String(name),
                            ];
                          }}
                        />
                        <Legend />
                        {activeDriverStandings.map((driver) => {
                          const teamColor = getTeamColor(driver.participant.team_id);
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
                  <h4 className={cx(styles.chartTitle, styles.chartHead)}>
                    <Award size={18} color="var(--accent-secondary)" aria-hidden="true" />
                    {t('history.progression.positionProgression', { count: driverStandings.length })}
                  </h4>
                  <div className={styles.chart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={positionProgressionData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
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
                          formatter={(val: unknown, name: unknown) => {
                            const driverIdx = String(name).replace('driver_', '');
                            const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                            return [`P${val}`, driver?.participant.name || String(name)];
                          }}
                        />
                        <Legend />
                        {activeDriverStandings.map((driver) => {
                          const teamColor = getTeamColor(driver.participant.team_id);
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
                  <h4 className={cx(styles.chartTitle, styles.chartHead)}>
                    <Layers size={18} color="var(--accent-tertiary)" aria-hidden="true" />
                    {t('history.progression.gapToLeaderDelta')}
                  </h4>
                  <div className={styles.chart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gapToLeaderData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
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
                          formatter={(val: unknown, name: unknown) => {
                            const driverIdx = String(name).replace('driver_', '');
                            const driver = driverStandings.find((d) => String(d.participant.car_index) === driverIdx);
                            const num = typeof val === 'number' ? val : Number(val);
                            return [
                              `+${Number.isFinite(num) ? num.toFixed(3) : 0}s`,
                              driver?.participant.name || String(name),
                            ];
                          }}
                        />
                        <Legend />
                        {activeDriverStandings.map((driver) => {
                          const teamColor = getTeamColor(driver.participant.team_id);
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
        </Panel>
      </TabPanel>
    </div>
  );
};
