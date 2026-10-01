import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Gauge } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { cssVar } from '../../../styles/theme';
import type { DriverStanding, FeedEvent, ProgressionRow } from '../../../types/session';
import { fieldPace, neutralisedLaps, raceControlPeriods } from '../../../utils/raceStory';
import { Panel, PanelHeader } from '../../ui/Panel';
import { raceControlAreas } from '../raceControlAreas';
import { compactTooltipProps } from '../stints/stintUtils';
import { AXIS_TICK } from '../../charts/chartTheme';
import styles from './FieldPaceChart.module.css';

interface FieldPaceChartProps {
  lapPace: ProgressionRow[] | undefined;
  driverStandings: DriverStanding[];
  playerCarIndex: number;
  events: FeedEvent[];
}


/**
 * Your lap times against the field's median and the fastest lap of each lap, with the safety car
 * periods shaded. The subtitle gives your average gap to the median on clean racing laps.
 */
export const FieldPaceChart: React.FC<FieldPaceChartProps> = ({ lapPace, driverStandings, playerCarIndex, events }) => {
  const { t } = useI18n();
  const periods = useMemo(() => raceControlPeriods(events), [events]);
  const lastLap = lapPace?.length ? lapPace[lapPace.length - 1].lapNumber : 0;
  const pace = useMemo(
    () =>
      fieldPace(
        lapPace,
        playerCarIndex,
        driverStandings.map((d) => d.participant.car_index),
        neutralisedLaps(periods, lastLap)
      ),
    [lapPace, playerCarIndex, driverStandings, periods, lastLap]
  );

  const domain = useMemo((): [number, number] | ['auto', 'auto'] => {
    const values = pace.rows.flatMap((r) => [r.you, r.median, r.fastest]).filter((v): v is number => v !== null);
    if (values.length === 0) return ['auto', 'auto'];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.08, 0.3);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [pace.rows]);

  if (!pace.rows.some((r) => r.you !== null)) return null;

  const average = pace.averageToMedian;
  const subtitle =
    average === null
      ? t('history.story.paceSub')
      : t(average <= 0 ? 'history.story.paceFaster' : 'history.story.paceSlower', {
          gap: Math.abs(average).toFixed(3),
          laps: pace.comparedLaps,
        });

  const names: Record<string, string> = {
    you: t('history.player.you'),
    median: t('history.story.fieldMedian'),
    fastest: t('history.story.fieldFastest'),
  };

  return (
    <Panel className={styles.panel}>
      <PanelHeader level={2} icon={<Gauge size={16} />} title={t('history.story.paceTitle')} subtitle={subtitle} />
      <div className={styles.chart} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pace.rows} margin={{ top: 16, right: 12, left: 0, bottom: 4 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
            <XAxis
              dataKey="lapNumber"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              stroke={cssVar('--text-muted')}
              tick={AXIS_TICK}
              tickFormatter={(v) => `L${v}`}
            />
            <YAxis
              width={48}
              stroke={cssVar('--text-muted')}
              tick={AXIS_TICK}
              domain={domain}
              allowDataOverflow
              tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            />
            {raceControlAreas(periods, lastLap, t)}
            <Tooltip
              {...compactTooltipProps}
              labelFormatter={(lap) => t('history.story.lapLabel', { lap: String(lap) })}
              formatter={(v, key) => [typeof v === 'number' ? `${v.toFixed(3)}s` : '—', names[String(key)] ?? key]}
            />
            <Line
              dataKey="fastest"
              stroke={cssVar('--f1-purple')}
              strokeDasharray="2 3"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="median"
              stroke={cssVar('--text-muted')}
              strokeDasharray="6 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="you"
              stroke={cssVar('--accent-primary')}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: cssVar('--accent-primary') }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className={styles.legend}>
        <li data-series="you">{names.you}</li>
        <li data-series="median">{names.median}</li>
        <li data-series="fastest">{names.fastest}</li>
        {periods.length > 0 && <li data-series="sc">{t('history.progression.scShading')}</li>}
      </ul>
    </Panel>
  );
};
