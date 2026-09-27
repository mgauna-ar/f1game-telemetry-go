import React from 'react';
import { Award, ArrowUpRight, ArrowDownRight, Activity, Clock } from 'lucide-react';
import type { Lap, Participant } from '../../types/session';
import { formatTime } from '../../utils/formatters';
import { TIME_CONSTANTS } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';
import { Badge } from '../ui/Badge';
import styles from './ComparatorMetricsSummary.module.css';

interface ComparatorMetricsSummaryProps {
  lapAObj?: Lap;
  lapBObj?: Lap;
  nameA: string;
  nameB: string;
  driverA?: Participant;
  driverB?: Participant;
  totalDeltaMs: number | null;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
}

const fasterSide = (delta: number) => (delta < 0 ? 'a' : delta > 0 ? 'b' : 'equal');

/** A lap is complete when it is valid, has a time and has reached sector 3. */
const isComplete = (lap?: Lap) => Boolean(lap?.is_valid && lap.lap_time_ms > 0 && lap.sector3_ms && lap.sector3_ms > 0);

const SectorDeltaBadge: React.FC<{ label: string; deltaMs: number | null }> = ({ label, deltaMs }) => {
  if (deltaMs === null || deltaMs === undefined) return null;
  const Arrow = deltaMs < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <div className={styles.sectorBadge}>
      <dt>{label}:</dt>
      <dd data-faster={fasterSide(deltaMs)}>
        {deltaMs === 0 ? '0.000s' : `${(deltaMs / 1000).toFixed(3)}s`}
        {deltaMs !== 0 && <Arrow size={14} aria-hidden="true" />}
      </dd>
    </div>
  );
};

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
    <div className={`glass-panel ${styles.card}`} data-slot={slot}>
      <h3 className={styles.cardTitle}>
        <span aria-hidden="true">●</span> {name}
      </h3>
      {lap ? (
        <div className={styles.cardBody}>
          <div className={styles.lapTime}>
            {complete ? formatTime(lap.lap_time_ms) : '--:--.---'}
            {!lap.is_valid ? (
              <span className={styles.flag} data-kind="invalid">
                ⚠️ {t('comparator.invalid')}
              </span>
            ) : !complete ? (
              <span className={styles.flag}>⚠️ {t('comparator.incomplete')}</span>
            ) : null}
            {lap.has_telemetry ? (
              <Badge tone="accent" size="xs" square icon={<Activity size={10} aria-hidden="true" />}>
                {t('comparator.charts.telemetryAvailable')}
              </Badge>
            ) : (
              <Badge tone="warning" size="xs" square icon={<Clock size={10} aria-hidden="true" />}>
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
                <dt>S{i + 1}</dt>
                <dd>{formatTime(lap[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className={styles.empty}>{emptyText}</p>
      )}
    </div>
  );
};

export const ComparatorMetricsSummary: React.FC<ComparatorMetricsSummaryProps> = ({
  lapAObj,
  lapBObj,
  nameA,
  nameB,
  driverA,
  driverB,
  totalDeltaMs,
  s1Delta,
  s2Delta,
  s3Delta,
}) => {
  const { t } = useI18n();
  const isBothComplete = isComplete(lapAObj) && isComplete(lapBObj);
  const deltaSeconds = totalDeltaMs === null ? '' : Math.abs(totalDeltaMs / TIME_CONSTANTS.MS_PER_SECOND).toFixed(3);

  return (
    <div className={styles.summary}>
      {isBothComplete && totalDeltaMs !== null && (
        <div className={`glass-panel ${styles.banner}`} data-faster={fasterSide(totalDeltaMs)}>
          <div className={styles.bannerMain}>
            <Award size={28} className={styles.bannerIcon} aria-hidden="true" />
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
          </div>

          <dl className={styles.sectorBadges}>
            <SectorDeltaBadge label={t('comparator.metrics.sectorDelta', { sector: 'S1' })} deltaMs={s1Delta} />
            <SectorDeltaBadge label={t('comparator.metrics.sectorDelta', { sector: 'S2' })} deltaMs={s2Delta} />
            <SectorDeltaBadge label={t('comparator.metrics.sectorDelta', { sector: 'S3' })} deltaMs={s3Delta} />
          </dl>
        </div>
      )}

      <div className={styles.cards}>
        <LapCard slot="a" name={nameA} lap={lapAObj} driver={driverA} emptyText={t('comparator.selectLapSlotA')} />
        <LapCard slot="b" name={nameB} lap={lapBObj} driver={driverB} emptyText={t('comparator.selectLapSlotB')} />
      </div>
    </div>
  );
};
