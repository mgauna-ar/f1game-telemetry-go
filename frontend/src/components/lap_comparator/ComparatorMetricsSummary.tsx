import React from 'react';
import { Award, Activity, Clock, TriangleAlert } from 'lucide-react';
import type { Lap, Participant } from '../../types/session';
import { formatTime } from '../../utils/formatters';
import { TIME_CONSTANTS } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';
import { Badge } from '../ui/Badge';
import { Panel } from '../ui/Panel';
import styles from './ComparatorMetricsSummary.module.css';

interface ComparatorMetricsSummaryProps {
  lapAObj?: Lap;
  lapBObj?: Lap;
  nameA: string;
  nameB: string;
  driverA?: Participant;
  driverB?: Participant;
  totalDeltaMs: number | null;
}

const fasterSide = (delta: number) => (delta < 0 ? 'a' : delta > 0 ? 'b' : 'equal');

/** A lap is complete when it is valid, has a time and has reached sector 3. */
const isComplete = (lap?: Lap) => Boolean(lap?.is_valid && lap.lap_time_ms > 0 && lap.sector3_ms && lap.sector3_ms > 0);

const LapCard: React.FC<{ slot: 'a' | 'b'; name: string; lap?: Lap; driver?: Participant; emptyText: string }> = ({
  slot,
  name,
  lap,
  driver,
  emptyText,
}) => {
  const { t } = useI18n();
  const complete = isComplete(lap);
  return (
    <Panel as="div" padding="compact" className={styles.card} data-slot={slot}>
      <h3 className={styles.cardTitle}>
        <span className={styles.dot} aria-hidden="true" />
        {name}
      </h3>
      {lap ? (
        <div className={styles.cardBody}>
          <div className={styles.lapTime}>
            {complete ? formatTime(lap.lap_time_ms) : '--:--.---'}
            {!lap.is_valid ? (
              <span className={styles.flag} data-kind="invalid">
                <TriangleAlert size={12} aria-hidden="true" />
                {t('comparator.invalid')}
              </span>
            ) : !complete ? (
              <span className={styles.flag}>
                <TriangleAlert size={12} aria-hidden="true" />
                {t('comparator.incomplete')}
              </span>
            ) : null}
            {lap.has_telemetry ? (
              <Badge tone="success" size="xs" square icon={<Activity size={12} aria-hidden="true" />}>
                {t('comparator.charts.telemetryAvailable')}
              </Badge>
            ) : (
              <Badge tone="warning" size="xs" square icon={<Clock size={12} aria-hidden="true" />}>
                {t('comparator.charts.timingOnly')}
              </Badge>
            )}
          </div>
          <div className={styles.driver}>
            {t('common.driver')}:{' '}
            <strong>{driver?.name || t('comparator.metrics.carFallback', { index: lap.car_index ?? '?' })}</strong> #
            {driver?.race_number ?? ''}
          </div>
          <dl className={styles.sectors}>
            {(['sector1_ms', 'sector2_ms', 'sector3_ms'] as const).map((key, i) => (
              <div key={key}>
                <dt className={styles.sectorLabel}>S{i + 1}</dt>
                <dd>{formatTime(lap[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className={styles.empty}>{emptyText}</p>
      )}
    </Panel>
  );
};

/** Who was faster and by how much (the sector deltas are in the duel header), then one card per lap. */
export const ComparatorMetricsSummary: React.FC<ComparatorMetricsSummaryProps> = ({
  lapAObj,
  lapBObj,
  nameA,
  nameB,
  driverA,
  driverB,
  totalDeltaMs,
}) => {
  const { t } = useI18n();
  const isBothComplete = isComplete(lapAObj) && isComplete(lapBObj);
  const deltaSeconds = totalDeltaMs === null ? '' : Math.abs(totalDeltaMs / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3);

  return (
    <div className={styles.summary}>
      {isBothComplete && totalDeltaMs !== null && (
        <Panel as="div" padding="compact" className={styles.banner} data-faster={fasterSide(totalDeltaMs)}>
          <Award size={20} className={styles.bannerIcon} aria-hidden="true" />
          <div>
            <p className={styles.bannerTitle}>
              {totalDeltaMs < 0
                ? t('comparator.metrics.fasterLapA', { driver: nameA, delta: deltaSeconds })
                : totalDeltaMs > 0
                  ? t('comparator.metrics.fasterLapB', { driver: nameB, delta: deltaSeconds })
                  : t('comparator.metrics.identicalTime')}
            </p>
            <span className={styles.bannerSub}>
              {nameA} ({formatTime(lapAObj?.lap_time_ms)}) vs {nameB} ({formatTime(lapBObj?.lap_time_ms)})
            </span>
          </div>
        </Panel>
      )}

      <div className={styles.cards}>
        <LapCard slot="a" name={nameA} lap={lapAObj} driver={driverA} emptyText={t('comparator.selectLapSlotA')} />
        <LapCard slot="b" name={nameB} lap={lapBObj} driver={driverB} emptyText={t('comparator.selectLapSlotB')} />
      </div>
    </div>
  );
};
