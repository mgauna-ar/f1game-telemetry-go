import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Award, Layers } from 'lucide-react';
import { getTeamColor } from '../../constants/f1';
import { cssVar } from '../../styles/theme';
import { compactTooltipProps } from './stints/stintUtils';
import { DriverFilterChips } from './DriverFilterChips';
import { defaultChartSelection, driverCode } from '../../utils/player';
import { raceControlPeriods } from '../../utils/raceStory';
import { raceControlAreas } from './raceControlAreas';
import type { DriverStanding, FeedEvent, ProgressionResponse, ProgressionRow } from '../../types/session';
import { useI18n } from '../../context/I18nContext';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { AskAiButton } from '../ai_engineer/AskAiButton';
import styles from './SessionLapChartsTab.module.css';

export type LapChartKind = 'pace' | 'position' | 'gap';

interface SessionLapChartsTabProps {
  /** Which chart: each one is its own tab of the session detail. */
  chart?: LapChartKind;
  progressionData?: ProgressionResponse | null;
  driverStandings: DriverStanding[];
  totalSessionLaps: number;
  formatLapTime: (ms: number) => string;
  isRaceSession?: boolean;
  /** Your car: picked by default with the cars around it, and marked in the driver chips. */
  playerCarIndex?: number | null;
  /** The session's race-control events, for the safety car and VSC shading. */
  events?: FeedEvent[];
  /** The drivers shown, when the parent keeps them across the three charts. */
  selectedDrivers?: Record<number, boolean>;
  onSelectedDriversChange?: (selected: Record<number, boolean>) => void;
}

const AXIS_TICK = { fill: cssVar('--text-muted'), fontSize: 11 };
/** Room on the right for the driver labels at the end of each line. */
const CHART_MARGIN = { top: 16, right: 44, left: 4, bottom: 8 };

interface EndLabelProps {
  index?: number;
  x?: number | string;
  y?: number | string;
}

/** The driver's code next to the last point of their line. */
const endLabel = (lastIndex: number, text: string, color: string) =>
  function EndLabel({ index, x, y }: EndLabelProps) {
    if (index !== lastIndex || x === undefined || y === undefined) return <g />;
    return (
      <text x={Number(x) + 6} y={Number(y)} dy={3} fill={color} fontSize={10} fontWeight={700}>
        {text}
      </text>
    );
  };

/** The last row where a series has a value. */
const lastIndexOf = (rows: readonly ProgressionRow[], key: string): number => {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (typeof rows[i][key] === 'number') return i;
  }
  return -1;
};

export const SessionLapChartsTab: React.FC<SessionLapChartsTabProps> = ({
  chart = 'pace',
  progressionData,
  driverStandings,
  totalSessionLaps,
  formatLapTime,
  playerCarIndex = null,
  events = [],
  selectedDrivers: controlledSelection,
  onSelectedDriversChange,
}) => {
  const { t } = useI18n();
  const [filterPitLaps, setFilterPitLaps] = useState<boolean>(true);

  // Drivers shown: you and the cars around you, or the top 5 when your car is unknown
  const [ownSelection, setOwnSelection] = useState<Record<number, boolean>>(() =>
    defaultChartSelection(driverStandings, playerCarIndex)
  );
  const selectedDrivers = controlledSelection ?? ownSelection;
  const setSelectedDrivers = (next: Record<number, boolean>) => {
    setOwnSelection(next);
    onSelectedDriversChange?.(next);
  };

  const activeDriverStandings = driverStandings.filter((d) => selectedDrivers[d.participant.car_index]);

  // The second car of a team shown is dashed, so teammates in the same colour stay apart
  const dashedCars = useMemo(() => {
    const seenTeams = new Set<number>();
    const dashed = new Set<number>();
    for (const d of activeDriverStandings) {
      if (seenTeams.has(d.participant.team_id)) dashed.add(d.participant.car_index);
      seenTeams.add(d.participant.team_id);
    }
    return dashed;
  }, [activeDriverStandings]);

  const rawLapPace = progressionData?.lap_pace;
  const rows: ProgressionRow[] = useMemo(() => {
    if (chart === 'position') return progressionData?.positions ?? [];
    if (chart === 'gap') return progressionData?.gap_to_leader ?? [];
    if (!rawLapPace) return [];
    if (!filterPitLaps) return rawLapPace;
    return rawLapPace.map((row) => {
      const filtered = { ...row };
      for (const d of activeDriverStandings) {
        const car = d.participant.car_index;
        if (row[`driver_${car}_is_outlier`]) filtered[`driver_${car}`] = null;
      }
      return filtered;
    });
  }, [chart, progressionData, rawLapPace, filterPitLaps, activeDriverStandings]);

  // Lap times: the y-range of the laps on screen, not the slowest lap of the session
  const paceDomain = useMemo((): [number, number] | null => {
    if (chart !== 'pace') return null;
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      for (const d of activeDriverStandings) {
        const v = row[`driver_${d.participant.car_index}`];
        if (typeof v === 'number' && v > 0) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    if (!Number.isFinite(min)) return null;
    const pad = Math.max((max - min) * 0.06, 0.3);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [chart, rows, activeDriverStandings]);

  // Pit stops, on the in-lap, as a marker along the bottom of the pace chart
  const pitStops = useMemo(() => {
    if (chart !== 'pace' || !rawLapPace) return [];
    const stops: Array<{ lap: number; car: number; color: string }> = [];
    for (const row of rawLapPace) {
      for (const d of activeDriverStandings) {
        const car = d.participant.car_index;
        if (row[`driver_${car}_outlier_reason`] === 'pit_in') {
          stops.push({ lap: row.lapNumber, car, color: getTeamColor(d.participant.team_id) });
        }
      }
    }
    return stops;
  }, [chart, rawLapPace, activeDriverStandings]);

  const periods = useMemo(() => raceControlPeriods(events), [events]);
  const lastLap = rows.length ? rows[rows.length - 1].lapNumber : totalSessionLaps;
  const lapLabel = (lap: unknown) => t('history.story.lapLabel', { lap: String(lap) });
  const driverName = (key: unknown) => {
    const car = String(key).replace('driver_', '');
    return driverStandings.find((d) => String(d.participant.car_index) === car)?.participant.name ?? String(key);
  };

  const tooltipFormatter = (val: unknown, name: unknown, item: { dataKey?: unknown; payload?: unknown }) => {
    const key = String(item?.dataKey ?? name);
    const num = typeof val === 'number' ? val : Number(val);
    if (chart === 'position') return [`P${val}`, driverName(key)];
    if (chart === 'gap') return [`+${Number.isFinite(num) ? num.toFixed(3) : 0}s`, driverName(key)];

    const payload = item?.payload as Record<string, unknown> | undefined;
    const rawMS = payload?.[`${key}_rawMS`] as number | undefined;
    const tyre = payload?.[`${key}_tyre`] as string | undefined;
    const reason = payload?.[`${key}_is_outlier`]
      ? (payload?.[`${key}_outlier_reason`] as string | undefined)
      : undefined;
    const reasonLabel = reason
      ? ` • ${t(
          reason === 'pit_in'
            ? 'history.progression.pitIn'
            : reason === 'pit_out'
              ? 'history.progression.pitOut'
              : reason === 'slow'
                ? 'history.progression.slowLap'
                : 'history.progression.pitStop'
        )}`
      : '';
    const time = rawMS ? formatLapTime(rawMS) : Number.isFinite(num) ? `${num}s` : '-';
    return [`${time} (${tyre || '—'}${reasonLabel})`, driverName(key)];
  };

  const heading = {
    pace: {
      icon: <Activity size={18} color={cssVar('--accent-primary')} aria-hidden="true" />,
      title: t('history.progression.lapByLapPace'),
    },
    position: {
      icon: <Award size={18} color={cssVar('--accent-secondary')} aria-hidden="true" />,
      title: t('history.progression.positionProgression', { count: driverStandings.length }),
    },
    gap: {
      icon: <Layers size={18} color={cssVar('--accent-tertiary')} aria-hidden="true" />,
      title: t('history.progression.gapToLeaderDelta'),
    },
  }[chart];

  return (
    <div className={styles.tab}>
      <Panel as="div" padding="compact">
        <DriverFilterChips
          label={`${t('history.progression.filterDrivers')} (${activeDriverStandings.length}/${driverStandings.length} ${t('history.progression.visible')})`}
          drivers={driverStandings}
          selected={selectedDrivers}
          playerCarIndex={playerCarIndex}
          onToggle={(car) => setSelectedDrivers({ ...selectedDrivers, [car]: !selectedDrivers[car] })}
          onSelectAll={() =>
            setSelectedDrivers(Object.fromEntries(driverStandings.map((d) => [d.participant.car_index, true])))
          }
          onClear={() => setSelectedDrivers({})}
          selectAllLabel={t('history.progression.selectAll')}
          clearLabel={t('history.progression.clear')}
        />
      </Panel>

      <Panel as="div" className={styles.chartPanel}>
        {activeDriverStandings.length === 0 ? (
          <EmptyState title={t('history.progression.selectDriverPrompt')} />
        ) : totalSessionLaps === 0 ? (
          <EmptyState title={t('history.progression.noLapProgression')} />
        ) : (
          <>
            <div className={styles.chartHead}>
              <h2 className={styles.chartTitle}>
                {heading.icon}
                {heading.title}
              </h2>
              <div className={styles.chartActions}>
                {chart === 'pace' && (
                  <label className={styles.pitFilter} title={t('history.progression.filterPitLapsDesc')}>
                    <input
                      type="checkbox"
                      data-testid="filter-pit-laps-checkbox"
                      checked={filterPitLaps}
                      onChange={(e) => setFilterPitLaps(e.target.checked)}
                    />
                    <span>{t('history.progression.filterPitLaps')}</span>
                  </label>
                )}
                <AskAiButton prompt={t(`history.detail.askAiPrompts.${chart}`)} about={heading.title} />
              </div>
            </div>
            <div className={styles.chart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                  <XAxis
                    dataKey="lapNumber"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    allowDecimals={false}
                    stroke={cssVar('--text-muted')}
                    tick={AXIS_TICK}
                    tickFormatter={(val) => `L${val}`}
                  />
                  {chart === 'pace' && (
                    <YAxis
                      stroke={cssVar('--text-muted')}
                      tick={AXIS_TICK}
                      domain={paceDomain ?? ['auto', 'auto']}
                      allowDataOverflow
                      tickFormatter={(val: number) => `${val.toFixed(1)}s`}
                    />
                  )}
                  {chart === 'position' && (
                    <YAxis
                      stroke={cssVar('--text-muted')}
                      tick={AXIS_TICK}
                      reversed
                      domain={[1, Math.max(driverStandings.length, 10)]}
                      tickFormatter={(val) => `P${val}`}
                    />
                  )}
                  {chart === 'gap' && (
                    <YAxis
                      stroke={cssVar('--text-muted')}
                      tick={AXIS_TICK}
                      domain={[0, 'auto']}
                      tickFormatter={(val: number) => `+${val.toFixed(1)}s`}
                    />
                  )}
                  {raceControlAreas(periods, lastLap, t)}
                  <Tooltip
                    {...compactTooltipProps}
                    filterNull={chart !== 'pace'}
                    labelFormatter={lapLabel}
                    formatter={tooltipFormatter}
                  />
                  {activeDriverStandings.map((driver) => {
                    const car = driver.participant.car_index;
                    const key = `driver_${car}`;
                    const color = getTeamColor(driver.participant.team_id);
                    const mine = car === playerCarIndex;
                    return (
                      <Line
                        key={car}
                        type={chart === 'position' ? 'stepAfter' : 'monotone'}
                        dataKey={key}
                        name={driver.participant.name}
                        stroke={color}
                        strokeWidth={mine ? 3 : 2}
                        strokeDasharray={dashedCars.has(car) ? '6 4' : undefined}
                        dot={chart === 'position' ? false : { r: 2.5, fill: color }}
                        activeDot={{ r: 5 }}
                        connectNulls
                        isAnimationActive={false}
                        label={endLabel(
                          lastIndexOf(rows, key),
                          driverCode(driver.participant.name, driver.participant.race_number),
                          color
                        )}
                      />
                    );
                  })}
                  {paceDomain &&
                    pitStops.map((s) => (
                      <ReferenceDot
                        key={`pit-${s.car}-${s.lap}`}
                        x={s.lap}
                        y={paceDomain[0]}
                        r={4}
                        fill={s.color}
                        stroke={cssVar('--text-primary')}
                        strokeWidth={1}
                        ifOverflow="visible"
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className={styles.legendNote}>
              {chart === 'pace' && pitStops.length > 0 && (
                <span className={styles.pitKey}>
                  <span className={styles.pitDot} aria-hidden="true" />
                  {t('history.progression.pitMarker')}
                </span>
              )}
              {periods.length > 0 && (
                <span className={styles.scKey}>
                  <span className={styles.scSwatch} aria-hidden="true" />
                  {t('history.progression.scShading')}
                </span>
              )}
              {dashedCars.size > 0 && <span>{t('history.progression.teammatesDashed')}</span>}
            </p>
          </>
        )}
      </Panel>
    </div>
  );
};
