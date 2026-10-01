import React, { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getTeamColor } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import { cssVar } from '../../../styles/theme';
import type { DegradationRow } from '../../../types/session';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Panel, PanelHeader } from '../../ui/Panel';
import { AskAiButton } from '../../ai_engineer/AskAiButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import styles from './DegradationCurves.module.css';
import { DegradationTable, type DegradationTableRow } from './DegradationTable';
import { compactTooltipProps, getCompoundColor, stintKey, type DriverStintData } from './stintUtils';

interface DegradationCurvesProps {
  degradationData: DegradationRow[];
  maxTyreAge: number;
  driverStintsData: DriverStintData[];
  /** The stints on the chart, by stint key. */
  selectedStints: Record<string, boolean>;
  toggleStint: (key: string) => void;
  selectAllStints: () => void;
  selectOnlyYours: (() => void) | null;
  clearStints: () => void;
  selectedCompound: string;
  setSelectedCompound: (compound: string) => void;
  sessionCompounds: string[];
  formatLapTime: (ms: number) => string;
  playerCarIndex?: number | null;
}

const AXIS_TICK = { fill: cssVar('--text-muted'), fontSize: 11 };

/**
 * Every stint's degradation in a sortable table, and the lap times of the stints ticked in it
 * against tyre age. Laps the fit leaves out (pit, safety car, slow) are hollow dots off the line.
 */
export const DegradationCurves: React.FC<DegradationCurvesProps> = ({
  degradationData,
  maxTyreAge,
  driverStintsData,
  selectedStints,
  toggleStint,
  selectAllStints,
  selectOnlyYours,
  clearStints,
  selectedCompound,
  setSelectedCompound,
  sessionCompounds,
  formatLapTime,
  playerCarIndex = null,
}) => {
  const { t } = useI18n();

  const rows: DegradationTableRow[] = useMemo(
    () =>
      driverStintsData.flatMap((d) =>
        d.stints
          .filter((s) => selectedCompound === 'ALL' || s.compound === selectedCompound)
          .map((stint) => ({
            key: stintKey(d.driver.participant.car_index, stint.stintIndex),
            driver: d.driver,
            stint,
          }))
      ),
    [driverStintsData, selectedCompound]
  );
  const charted = rows.filter((r) => selectedStints[r.key]);
  const names = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  // The y-range fits the laps in the fit, up to 107% of their median: a left-out lap (an in-lap,
  // a safety car lap) or a stint run behind a safety car the session didn't store is clipped
  // rather than flattening every curve
  const chartedKeys = charted.map((r) => r.key).join(',');
  const domain = useMemo((): [number, number] | ['auto', 'auto'] => {
    const keys = chartedKeys.split(',');
    const values = degradationData
      .flatMap((row) => keys.map((k) => row[k]).filter((v): v is number => typeof v === 'number'))
      .sort((a, b) => a - b);
    if (values.length === 0) return ['auto', 'auto'];
    const min = values[0];
    const max = Math.min(values[values.length - 1], values[values.length >> 1] * 1.07);
    const pad = Math.max((max - min) * 0.1, 0.3);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [degradationData, chartedKeys]);

  const tooltipName = (dataKey: string) => {
    const key = dataKey.replace(/_excluded$/, '');
    const row = names.get(key);
    return row ? { row, excluded: key !== dataKey } : null;
  };

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        icon={<TrendingUp size={18} color="var(--accent-secondary)" />}
        title={t('history.stints.degradation.title')}
        subtitle={t('history.stints.degradation.subtitle')}
        actions={
          <>
            <SegmentedControl
              size="xs"
              aria-label={t('history.stints.degradation.filterCompounds')}
              value={selectedCompound}
              onChange={setSelectedCompound}
              options={[
                { value: 'ALL', label: t('history.stints.degradation.allCompounds') },
                ...sessionCompounds.map((comp) => ({
                  value: comp,
                  label: comp,
                  icon: <TyreCompoundBadge compound={comp} />,
                })),
              ]}
            />
            <AskAiButton
              prompt={t('history.detail.askAiPrompts.stints')}
              about={t('history.stints.degradation.title')}
            />
          </>
        }
      />

      <div className={styles.toolbar}>
        <span className={styles.count} aria-live="polite">
          {t('history.stints.degradation.shown', { count: charted.length, total: rows.length })}
        </span>
        <div className={styles.actions}>
          {selectOnlyYours && (
            <Button size="sm" onClick={selectOnlyYours}>
              {t('history.stints.degradation.onlyYours')}
            </Button>
          )}
          <Button size="sm" onClick={selectAllStints}>
            {t('history.stints.degradation.selectAll')}
          </Button>
          <Button size="sm" onClick={clearStints}>
            {t('history.stints.degradation.clear')}
          </Button>
        </div>
      </div>

      <DegradationTable
        rows={rows}
        selected={selectedStints}
        onToggle={toggleStint}
        formatLapTime={formatLapTime}
        playerCarIndex={playerCarIndex}
      />

      {charted.length === 0 || degradationData.length === 0 || maxTyreAge === 0 ? (
        <EmptyState title={t('history.stints.degradation.noDegradationData')} />
      ) : (
        <>
          <div className={styles.chart} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={degradationData}
                margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
                accessibilityLayer={false}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
                <XAxis
                  dataKey="tyreAge"
                  stroke={cssVar('--text-muted')}
                  tick={AXIS_TICK}
                  tickFormatter={(age) => t('history.stints.degradation.ageTick', { age: String(age) })}
                />
                <YAxis
                  width={52}
                  stroke={cssVar('--text-muted')}
                  tick={AXIS_TICK}
                  domain={domain}
                  allowDataOverflow
                  tickFormatter={(val: number) => `${val.toFixed(1)}s`}
                />
                <Tooltip
                  {...compactTooltipProps}
                  labelFormatter={(age) => t('history.stints.degradation.ageLabel', { age: String(age) })}
                  formatter={(val, name, item) => {
                    const dataKey = String(item?.dataKey ?? name);
                    const found = tooltipName(dataKey);
                    const payload = item?.payload as Record<string, unknown> | undefined;
                    const key = dataKey.replace(/_excluded$/, '');
                    const rawMS = payload?.[`${key}_rawMS`] as number | undefined;
                    const lapNum = payload?.[`${key}_lapNum`] as number | undefined;
                    const reason = payload?.[`${key}_reason`] as string | undefined;
                    const time = rawMS ? formatLapTime(rawMS) : `${val}s`;
                    if (!found) return [time, String(name)];
                    const label = t('history.stints.degradation.tooltipSeries', {
                      driver: found.row.driver.participant.name,
                      stint: found.row.stint.stintIndex,
                      compound: found.row.stint.compound,
                      lap: lapNum ?? '?',
                    });
                    return [
                      found.excluded && reason
                        ? `${time} (${t('history.stints.degradation.tooltipLeftOut', {
                            reason: t(`history.stints.degradation.reasons.${reason}`),
                          })})`
                        : time,
                      label,
                    ];
                  }}
                />

                {charted.flatMap(({ key, driver, stint }) => {
                  const teamColor = getTeamColor(driver.participant.team_id);
                  const mine = driver.participant.car_index === playerCarIndex;
                  return [
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={teamColor}
                      strokeWidth={mine ? 3 : 2}
                      strokeDasharray={stint.stintIndex > 1 ? '5 4' : undefined}
                      dot={{ r: 3, fill: getCompoundColor(stint.compound), stroke: teamColor }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />,
                    <Line
                      key={`${key}_excluded`}
                      dataKey={`${key}_excluded`}
                      stroke="none"
                      dot={{ r: 3.5, fill: cssVar('--bg-panel-solid'), stroke: teamColor, strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: cssVar('--bg-panel-solid'), stroke: teamColor }}
                      legendType="none"
                      isAnimationActive={false}
                    />,
                  ];
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className={styles.legend}>
            <li data-series="fit">{t('history.stints.degradation.legendFit')}</li>
            <li data-series="out">{t('history.stints.degradation.legendLeftOut')}</li>
            <li data-series="later">{t('history.stints.degradation.legendLaterStint')}</li>
          </ul>
        </>
      )}
    </Panel>
  );
};
