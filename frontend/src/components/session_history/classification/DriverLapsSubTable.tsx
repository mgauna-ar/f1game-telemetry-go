import React, { useMemo } from 'react';
import { Clock, GitCompare } from 'lucide-react';
import { formatSectorTime } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';
import type { Session, Lap, DriverStanding, StagedLap } from '../../../types/session';
import { SectorTime } from '../../common/SectorTime';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import styles from './DriverLapsSubTable.module.css';
import { useUnits } from '../../../hooks/useUnits';

interface DriverLapsSubTableProps {
  session: Session;
  driver: DriverStanding;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onStageLap?: (lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onSendToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
  renderTyreBadge: (compoundRaw?: string, actualCompound?: string) => React.ReactNode;
}

interface LapRow {
  lap: Lap;
  runningRaceTime: number;
  sectors: [number, number, number];
}

export const DriverLapsSubTable: React.FC<DriverLapsSubTableProps> = React.memo(
  ({
    session,
    driver,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    stagedA,
    stagedB,
    onStageLap,
    onSendToComparator,
    formatLapTime,
    formatTotalDuration,
    renderTyreBadge,
  }) => {
    const { t } = useI18n();
    const units = useUnits();

    const rows = useMemo<LapRow[]>(() => {
      let runningRaceTime = 0;
      return driver.laps
        .filter((lap) => lap.lap_time_ms > 0)
        .map((lap) => {
          runningRaceTime += lap.lap_time_ms;
          const s1 = lap.sector1_ms ?? 0;
          const s2 = lap.sector2_ms ?? 0;
          let s3 = lap.sector3_ms ?? 0;
          if (s3 === 0 && lap.lap_time_ms > 0 && s1 > 0 && s2 > 0) {
            s3 = lap.lap_time_ms - (s1 + s2);
          }
          return { lap, runningRaceTime, sectors: [s1, s2, s3] };
        });
    }, [driver.laps]);

    const isPersonalBest = (lap: Lap) => !!driver.bestLap && lap.id === driver.bestLap.id;
    const sub = (key: string) => t(`history.classification.subHeaders.${key}`);

    const stage = (lap: Lap, slot: 'A' | 'B') => {
      if (onStageLap) {
        onStageLap(lap, driver, slot);
      } else if (onSendToComparator) {
        onSendToComparator(session.id, lap.id, slot);
      }
    };

    const sectorColumn = (index: 0 | 1 | 2): DataTableColumn<LapRow> => ({
      key: `s${index + 1}`,
      header: sub(`s${index + 1}`),
      numeric: true,
      align: 'left',
      cell: ({ sectors }) => {
        const time = sectors[index];
        const sessionBest = [sessionBestS1, sessionBestS2, sessionBestS3][index];
        const personalBest = [driver.bestS1MS, driver.bestS2MS, driver.bestS3MS][index];
        const isPurple = time > 0 && sessionBest > 0 && time <= sessionBest;
        const isGreen = !isPurple && time > 0 && time <= personalBest;
        return (
          <SectorTime isSessionBest={isPurple} isPersonalBest={isGreen} isSlower={time > 0}>
            {formatSectorTime(time, false)}
          </SectorTime>
        );
      },
    });

    const stageButton = (lap: Lap, slot: 'A' | 'B') => {
      const staged = (slot === 'A' ? stagedA : stagedB)?.lapId === lap.id;
      const slotLabel = t(`history.classification.stageSlot${slot}`);
      return (
        <Button
          size="sm"
          aria-pressed={staged}
          className={cx(styles.stage, slot === 'A' ? styles.slotA : styles.slotB)}
          title={
            staged
              ? t(`history.classification.stagedInSlot${slot}`)
              : t(`history.classification.stageLapInSlot${slot}`, { lap: lap.lap_number })
          }
          icon={<GitCompare size={11} aria-hidden="true" />}
          onClick={(e) => {
            e.stopPropagation();
            stage(lap, slot);
          }}
        >
          {staged ? `✓ ${slotLabel}` : slotLabel}
        </Button>
      );
    };

    const columns: DataTableColumn<LapRow>[] = [
      {
        key: 'lap',
        header: sub('lapNumber'),
        rowHeader: true,
        numeric: true,
        align: 'left',
        className: styles.lapNumber,
        cell: ({ lap }) => t('history.classification.lapItem', { number: lap.lap_number }),
      },
      {
        key: 'time',
        header: sub('lapTime'),
        numeric: true,
        align: 'left',
        cell: ({ lap }) =>
          isPersonalBest(lap) ? (
            <span className={styles.personalBest} title={t('history.classification.personalBest')}>
              {formatLapTime(lap.lap_time_ms)}
              <span className="sr-only"> ({t('history.classification.personalBest')})</span>
            </span>
          ) : (
            formatLapTime(lap.lap_time_ms)
          ),
      },
      sectorColumn(0),
      sectorColumn(1),
      sectorColumn(2),
      {
        key: 'cumulative',
        header: sub('cumulative'),
        numeric: true,
        align: 'left',
        className: styles.muted,
        cell: ({ runningRaceTime }) => formatTotalDuration(runningRaceTime),
      },
      {
        key: 'delta',
        header: sub('deltaToBest'),
        numeric: true,
        align: 'left',
        cell: ({ lap }) => {
          if (!driver.bestLap || lap.lap_time_ms <= 0) return <span className={styles.faint}>--</span>;
          if (isPersonalBest(lap)) {
            return <span className={styles.personalBestDelta}>{t('history.classification.personalBest')}</span>;
          }
          return (
            <span className={styles.faint}>+{((lap.lap_time_ms - driver.bestLap.lap_time_ms) / 1000).toFixed(3)}s</span>
          );
        },
      },
      {
        key: 'speed',
        header: sub('maxSpeed'),
        numeric: true,
        align: 'left',
        cell: ({ lap }) => units.speed(lap.max_speed_kmh || null, 1, '-'),
      },
      {
        key: 'tyre',
        header: sub('tyre'),
        cell: ({ lap }) => (
          <div className={styles.tyre}>
            {renderTyreBadge(lap.tyre_compound, lap.actual_compound)}
            {lap.stint && lap.stint > 0 && (
              <Badge size="xs" square title={t('history.classification.stintTooltip', { number: lap.stint })}>
                {t('history.classification.stintShort', { number: lap.stint })}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: sub('status'),
        cell: ({ lap }) => (
          <Badge tone={lap.is_valid ? 'success' : 'danger'} size="xs" uppercase>
            {lap.is_valid ? t('history.classification.valid') : t('history.classification.invalid')}
          </Badge>
        ),
      },
      {
        key: 'compare',
        header: sub('compareTelemetry'),
        align: 'right',
        cell: ({ lap }) =>
          (onStageLap || onSendToComparator) && (
            <div className={styles.stageButtons}>
              {stageButton(lap, 'A')}
              {stageButton(lap, 'B')}
            </div>
          ),
      },
    ];

    return (
      <div className={styles.box}>
        <DataTable
          caption={
            <span className={styles.caption}>
              <span className={styles.title}>
                <Clock size={14} aria-hidden="true" />
                {t('history.classification.recordedLapsFor', { name: driver.participant.name })}
              </span>
              <span className={styles.helper}>{t('history.classification.slotHelperText')}</span>
            </span>
          }
          showCaption
          columns={columns}
          rows={rows}
          getRowKey={({ lap }) => lap.id}
          density="compact"
        />
      </div>
    );
  }
);

DriverLapsSubTable.displayName = 'DriverLapsSubTable';
