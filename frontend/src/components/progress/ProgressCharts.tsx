import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type XAxisTickContentProps,
} from 'recharts';
import { Activity, Clock, Target } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { maxWidth } from '../../styles/breakpoints';
import { cssVar } from '../../styles/theme';
import type { ProgressSession } from '../../types/progress';
import { formatLapTime, formatSectorTime } from '../../utils/formatters';
import { sessionTypeLabel } from '../../utils/sessionTypeLabel';
import { AXIS_PROPS, AXIS_TICK, GRID_PROPS, NO_ANIMATION, TOOLTIP_PROPS } from '../charts/chartTheme';
import { ChartLegend, type ChartLegendItem } from '../charts/ChartLegend';
import { Panel, PanelHeader } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { sessionKind } from '../session_history/sessionKind';
import { formatChange, formatSpread, SECTOR_KEYS, shortDate, type SectorKey } from './progressStats';
import styles from './ProgressCharts.module.css';

type TimeView = 'lap' | SectorKey;

interface ChartRow {
  index: number;
  lap: number | null;
  fastest: number | null;
  best_sector1_ms: number | null;
  best_sector2_ms: number | null;
  best_sector3_ms: number | null;
  gap: number | null;
  consistency: number | null;
}

const orNull = (ms: number | null | undefined): number | null => (ms && ms > 0 ? ms : null);

/** Seconds with one decimal, for the gap and consistency axes. */
const axisSeconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** Your best lap and sectors, the gap to each session's fastest lap and your consistency, one point per session. */
export const ProgressCharts: React.FC<{ sessions: ProgressSession[] }> = ({ sessions }) => {
  const { t, locale } = useI18n();
  const [view, setView] = useState<TimeView>('lap');
  const isPhone = useMediaQuery(maxWidth('phone'));

  const rows = useMemo<ChartRow[]>(
    () =>
      sessions.map((s, index) => ({
        index,
        lap: orNull(s.best_lap_time_ms),
        fastest: orNull(s.fastest_lap_time_ms),
        best_sector1_ms: orNull(s.best_sector1_ms),
        best_sector2_ms: orNull(s.best_sector2_ms),
        best_sector3_ms: orNull(s.best_sector3_ms),
        gap: s.gap_to_fastest_ms ?? null,
        consistency: s.consistency_ms ?? null,
      })),
    [sessions]
  );

  // Each tick names the session by its date and kind, since a weekend has several on one day
  const renderTick = ({ x: xValue, y: yValue, payload }: XAxisTickContentProps) => {
    const x = Number(xValue);
    const y = Number(yValue);
    const s = sessions[Number(payload.value)];
    if (!s) return <g />;
    const kind = sessionKind(s.session_type);
    return (
      <text x={x} y={y + 12} textAnchor="middle" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize}>
        <tspan x={x}>{shortDate(s.created_at, locale)}</tspan>
        {kind && (
          <tspan x={x} dy={13}>
            {t(`progress.kinds.${kind}`)}
          </tspan>
        )}
      </text>
    );
  };
  const tooltipLabel = (index: unknown) => {
    const s = sessions[Number(index)];
    return s ? `${sessionTypeLabel(s.session_type, t)} · ${shortDate(s.created_at, locale)}` : '';
  };
  // The ticks are drawn by hand, so Recharts can't measure them to skip the ones that would collide
  const tickInterval = Math.max(0, Math.ceil(sessions.length / (isPhone ? 3 : 8)) - 1);
  const xAxis = (
    <XAxis dataKey="index" stroke={AXIS_PROPS.stroke} tick={renderTick} height={40} interval={tickInterval} />
  );
  const grid = <CartesianGrid {...GRID_PROPS} />;

  const timeFormat = view === 'lap' ? formatLapTime : (ms: number) => formatSectorTime(ms);
  const viewOptions = [
    { value: 'lap' as const, label: t('progress.charts.lap') },
    ...SECTOR_KEYS.map((key, i) => ({ value: key, label: `S${i + 1}` })),
  ];
  const timeLegend: ChartLegendItem[] = [
    { id: 'you', label: t('progress.charts.you'), color: cssVar('--f1-you'), emphasis: true },
    ...(view === 'lap'
      ? [
          {
            id: 'fastest',
            label: t('progress.charts.sessionFastest'),
            color: cssVar('--f1-purple'),
            shape: 'dashed' as const,
          },
        ]
      : []),
  ];

  return (
    <>
      <Panel className={styles.panel}>
        <PanelHeader
          level={2}
          icon={<Clock size={16} />}
          title={t('progress.charts.title')}
          actions={
            <SegmentedControl
              size="xs"
              options={viewOptions}
              value={view}
              onChange={setView}
              aria-label={t('progress.charts.tabsLabel')}
            />
          }
        />
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 32, left: 0, bottom: 0 }}>
              {grid}
              {xAxis}
              <YAxis {...AXIS_PROPS} domain={['auto', 'auto']} tickFormatter={timeFormat} width={72} />
              <Tooltip
                {...TOOLTIP_PROPS}
                labelFormatter={tooltipLabel}
                formatter={(value) => timeFormat(Number(value))}
              />
              <Line
                type="linear"
                dataKey={view}
                name={t('progress.charts.you')}
                stroke={cssVar('--f1-you')}
                strokeWidth={2}
                dot={{ r: 4, fill: cssVar('--f1-you') }}
                activeDot={{ r: 6 }}
                connectNulls
                {...NO_ANIMATION}
              />
              {view === 'lap' && (
                <Line
                  type="linear"
                  dataKey="fastest"
                  name={t('progress.charts.sessionFastest')}
                  stroke={cssVar('--f1-purple')}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: cssVar('--f1-purple') }}
                  connectNulls
                  {...NO_ANIMATION}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend items={timeLegend} />
      </Panel>

      <div className={styles.pair}>
        <Panel className={styles.panel}>
          <PanelHeader
            level={2}
            icon={<Target size={16} />}
            title={t('progress.charts.gapTitle')}
            subtitle={t('progress.charts.gapHelp')}
          />
          <div className={styles.smallChart}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 10, right: 32, left: 0, bottom: 0 }}>
                {grid}
                {xAxis}
                <YAxis {...AXIS_PROPS} tickFormatter={axisSeconds} width={56} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  cursor={{ fill: cssVar('--chart-grid') }}
                  labelFormatter={tooltipLabel}
                  formatter={(value) =>
                    Number(value) === 0 ? t('progress.stats.fastest') : formatChange(Number(value))
                  }
                />
                <Bar
                  dataKey="gap"
                  name={t('progress.stats.gap')}
                  fill={cssVar('--accent-secondary')}
                  fillOpacity={0.5}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  {...NO_ANIMATION}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className={styles.panel}>
          <PanelHeader
            level={2}
            icon={<Activity size={16} />}
            title={t('progress.charts.consistencyTitle')}
            subtitle={t('progress.charts.consistencyHelp')}
          />
          <div className={styles.smallChart}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 32, left: 0, bottom: 0 }}>
                {grid}
                {xAxis}
                <YAxis {...AXIS_PROPS} domain={[0, 'auto']} tickFormatter={axisSeconds} width={56} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={tooltipLabel}
                  formatter={(value, _name, item) => {
                    const s = sessions[(item?.payload as ChartRow | undefined)?.index ?? -1];
                    const text = formatSpread(Number(value));
                    return s ? `${text} (${t('progress.charts.cleanLaps', { count: s.clean_laps })})` : text;
                  }}
                />
                <Line
                  type="linear"
                  dataKey="consistency"
                  name={t('progress.stats.consistency')}
                  stroke={cssVar('--accent-secondary')}
                  strokeWidth={2}
                  dot={{ r: 4, fill: cssVar('--accent-secondary') }}
                  connectNulls
                  {...NO_ANIMATION}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </>
  );
};
