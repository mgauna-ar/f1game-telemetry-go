import React from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getTeamColor, RESULT_REASONS, RESULT_STATUS } from '../../../constants/f1';
import { formatSectorTime } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';
import { styleVars } from '../../../styles/theme';
import { SectorTime } from '../../common/SectorTime';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import type { DataTableColumn } from '../../ui/DataTable';
import type { Lap, DriverStanding } from '../../../types/session';
import styles from './ClassificationTable.module.css';
import { useUnits } from '../../../hooks/useUnits';

export interface ClassificationColumnsOptions {
  isRaceSession: boolean;
  /** Whether the table has a points column (hidden when nobody scored). */
  showPoints: boolean;
  leaderBestLapMS: number;
  leaderTotalRaceTimeMS?: number;
  leaderLapsCount: number;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  sessionFastestLapMS: number;
  expandedDrivers: Record<number, boolean>;
  onToggleDriverExpand: (carIndex: number) => void;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
  renderDriverTyreStints: (laps: Lap[]) => React.ReactNode;
  /** Your car, whose name is marked YOU. */
  playerCarIndex?: number | null;
  /** Gap to the leader, or interval to the car ahead. */
  gapMode: GapMode;
  /** The rows in table order, for the car ahead of each one. */
  standings: readonly DriverStanding[];
}

export type GapMode = 'gap' | 'interval';

type Translate = ReturnType<typeof useI18n>['t'];

const plusSeconds = (ms: number) => `+${(Math.max(ms, 0) / 1000).toFixed(3)}s`;

const lapDiffText = (lapDiff: number, t: Translate) =>
  lapDiff === 1
    ? t('history.classification.lapDiffSingular', { count: lapDiff })
    : t('history.classification.lapDiffPlural', { count: lapDiff });

/**
 * The Time/Gap cell's text, with the reason a car didn't finish. In interval mode the gap is to
 * the car ahead (`ahead`, the row above), in laps when it lapped this car; the leader and the
 * cars that didn't finish read the same in both modes.
 */
const timeGapText = (
  driver: DriverStanding,
  ahead: DriverStanding | undefined,
  o: ClassificationColumnsOptions,
  t: Translate
): string => {
  const isLeader = driver.position === 1;
  const interval = o.gapMode === 'interval' && ahead !== undefined;
  if (!o.isRaceSession) {
    if (isLeader) return t('history.classification.leader');
    const reference = interval ? ahead.bestLapTimeMS : o.leaderBestLapMS;
    if (driver.bestLapTimeMS > 0 && driver.bestLapTimeMS < Infinity && reference > 0 && reference < Infinity) {
      return plusSeconds(driver.bestLapTimeMS - reference);
    }
    return '--';
  }

  if (driver.isDSQ) {
    return driver.resultReason === RESULT_REASONS.BLACK_FLAGGED
      ? `DSQ (${t('history.classification.reasons.blackFlag')})`
      : 'DSQ';
  }
  if (driver.isDNF) {
    const lastLapStatus = driver.laps?.[driver.laps.length - 1]?.result_status ?? driver.participant?.result_status;
    if (driver.resultReason === RESULT_REASONS.TERMINAL_DAMAGE) {
      return `DNF (${t('history.classification.reasons.terminalDamage')})`;
    }
    if (driver.resultReason === RESULT_REASONS.MECHANICAL_FAILURE) {
      return `DNF (${t('history.classification.reasons.mechanicalFailure')})`;
    }
    if (driver.resultReason === RESULT_REASONS.RETIRED || lastLapStatus === RESULT_STATUS.RETIRED) {
      return `DNF (${t('history.classification.reasons.retired')})`;
    }
    if (driver.resultReason === RESULT_REASONS.NOT_ENOUGH_LAPS) {
      return `DNF (${t('history.classification.reasons.notEnoughLaps')})`;
    }
    return 'DNF';
  }
  if (isLeader) return o.formatTotalDuration(driver.totalRaceTimeWithPenalties ?? 0);

  const driverLapsCount = driver.laps.length;
  const driverTime = driver.totalRaceTimeWithPenalties ?? 0;
  if (interval && !ahead.isDNF && !ahead.isDSQ) {
    if (driverLapsCount < ahead.laps.length) return lapDiffText(ahead.laps.length - driverLapsCount, t);
    const aheadTime = ahead.totalRaceTimeWithPenalties ?? 0;
    return driverTime > 0 && aheadTime > 0 ? plusSeconds(driverTime - aheadTime) : '--';
  }
  if (o.leaderLapsCount > 0 && driverLapsCount < o.leaderLapsCount) {
    return lapDiffText(o.leaderLapsCount - driverLapsCount, t);
  }
  if (driverTime > 0 && (o.leaderTotalRaceTimeMS ?? 0) > 0) {
    return plusSeconds(driverTime - (o.leaderTotalRaceTimeMS ?? 0));
  }
  return '--';
};

/** The sectors of the driver's best lap; S3 is derived when the game didn't record it. */
const bestLapSectors = (driver: DriverStanding): [number, number, number] => {
  const s1 = driver.bestLap?.sector1_ms ?? 0;
  const s2 = driver.bestLap?.sector2_ms ?? 0;
  let s3 = driver.bestLap?.sector3_ms ?? 0;
  if (s3 <= 0 && driver.bestLap && driver.bestLap.lap_time_ms > 0 && s1 > 0 && s2 > 0) {
    s3 = driver.bestLap.lap_time_ms - (s1 + s2);
  }
  return [s1, s2, s3];
};

/** Columns of the classification table, for race or timing sessions. */
export const useClassificationColumns = (o: ClassificationColumnsOptions): DataTableColumn<DriverStanding>[] => {
  const { t } = useI18n();
  const units = useUnits();
  const h = (key: string) => t(`history.classification.headers.${key}`);

  const pos: DataTableColumn<DriverStanding> = {
    key: 'pos',
    header: h('pos'),
    width: o.isRaceSession ? '55px' : '38px',
    cell: (driver) => {
      const gained = driver.positionsGained;
      return (
        <div className={styles.pos}>
          <span
            className={cx(
              styles.posNumber,
              driver.position === 1 && styles.winner,
              driver.position > 1 && driver.position <= 3 && styles.podium
            )}
          >
            P{driver.position}
          </span>
          {o.isRaceSession && gained !== undefined && (
            <span
              className={cx(styles.gridDelta, gained > 0 && styles.gained, gained < 0 && styles.lost)}
              title={t('history.classification.gridTooltip', {
                grid: driver.gridPosition ?? 0,
                finish: driver.position,
                delta: gained > 0 ? `+${gained}` : `${gained}`,
              })}
            >
              {gained > 0 ? `▲${gained}` : gained < 0 ? `▼${Math.abs(gained)}` : '-'}
            </span>
          )}
        </div>
      );
    },
  };

  const driverColumn: DataTableColumn<DriverStanding> = {
    key: 'driver',
    header: h('driver'),
    rowHeader: true,
    className: styles.driverCol,
    cell: (driver) => (
      <div className={styles.driver} style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}>
        <span className={styles.teamBar} aria-hidden="true" />
        <span className={styles.driverText}>
          <span className={styles.driverName}>{driver.participant.name}</span>
          <span className={styles.raceNumber}>#{driver.participant.race_number}</span>
        </span>
        {driver.participant.car_index === o.playerCarIndex && (
          <Badge tone="accent" size="xs" className={styles.youBadge}>
            {t('history.player.you')}
          </Badge>
        )}
      </div>
    ),
  };

  const timeGap: DataTableColumn<DriverStanding> = {
    key: 'timeGap',
    header: h(o.gapMode === 'interval' ? 'interval' : o.isRaceSession ? 'timeGap' : 'gap'),
    numeric: true,
    align: 'left',
    className: o.isRaceSession ? styles.timeCol : styles.gapCol,
    cell: (driver, index) => {
      const isLeader = driver.position === 1;
      const out = o.isRaceSession && (driver.isDSQ || driver.isDNF);
      return (
        <div className={cx(styles.timeGap, out && styles.out, isLeader && !out && styles.leader)}>
          {o.isRaceSession && isLeader && !out && <Clock size={11} className={styles.clock} aria-hidden="true" />}
          <span>{timeGapText(driver, index > 0 ? o.standings[index - 1] : undefined, o, t)}</span>
          {o.isRaceSession && (driver.penaltySeconds ?? 0) > 0 && (
            <Badge
              tone="danger"
              size="xs"
              square
              title={t('history.classification.penaltyIncluded', { seconds: driver.penaltySeconds ?? 0 })}
            >
              +{driver.penaltySeconds}s
            </Badge>
          )}
        </div>
      );
    },
  };

  const laps: DataTableColumn<DriverStanding> = {
    key: 'laps',
    header: h('laps'),
    numeric: true,
    align: 'center',
    width: '45px',
    className: styles.muted,
    cell: (driver) => driver.laps.length,
  };

  const stints: DataTableColumn<DriverStanding> = {
    key: 'stints',
    header: h('tyreStints'),
    className: styles.stintsCol,
    cell: (driver) => o.renderDriverTyreStints(driver.laps),
  };

  const points: DataTableColumn<DriverStanding> = {
    key: 'points',
    header: h('points'),
    numeric: true,
    align: 'center',
    width: '45px',
    cell: (driver) =>
      (driver.points ?? 0) > 0 ? (
        <Badge color="var(--f1-gold)" size="xs" square>
          {driver.points}
        </Badge>
      ) : (
        <span className={styles.noPoints}>0</span>
      ),
  };

  const bestLap: DataTableColumn<DriverStanding> = {
    key: 'bestLap',
    header: h(o.isRaceSession ? 'fastestLap' : 'bestLap'),
    numeric: true,
    align: 'left',
    className: styles.lapCol,
    cell: (driver) => {
      const isOverallFastest =
        o.sessionFastestLapMS > 0 && driver.bestLapTimeMS > 0 && driver.bestLapTimeMS === o.sessionFastestLapMS;
      return (
        <div className={cx(styles.bestLap, isOverallFastest && styles.fastestOverall)}>
          {driver.bestLap ? o.formatLapTime(driver.bestLap.lap_time_ms) : '--:--.---'}
          {isOverallFastest && (
            <Badge
              tone="purple"
              size="xs"
              square
              title={t(
                o.isRaceSession ? 'history.classification.sessionFastestLap' : 'history.classification.poleFastestLap'
              )}
            >
              {t('history.classification.flBadge')}
            </Badge>
          )}
        </div>
      );
    },
  };

  const sector = (index: 0 | 1 | 2): DataTableColumn<DriverStanding> => ({
    key: `s${index + 1}`,
    header: h(`s${index + 1}`),
    numeric: true,
    align: 'left',
    className: styles.sectorCol,
    cell: (driver) => {
      const time = bestLapSectors(driver)[index];
      const sessionBest = [o.sessionBestS1, o.sessionBestS2, o.sessionBestS3][index];
      const personalBest = [driver.bestS1MS, driver.bestS2MS, driver.bestS3MS][index];
      const isPurple = time > 0 && sessionBest > 0 && time <= sessionBest;
      const isGreen = !isPurple && time > 0 && personalBest > 0 && time <= personalBest;
      return (
        <SectorTime isSessionBest={isPurple} isPersonalBest={isGreen} isSlower={time > 0} className={styles.sectorTime}>
          {formatSectorTime(time, false)}
        </SectorTime>
      );
    },
  });

  const topSpeed: DataTableColumn<DriverStanding> = {
    key: 'topSpeed',
    header: h('topSpeed'),
    numeric: true,
    align: 'left',
    className: styles.speedCol,
    cell: (driver) => units.speed(driver.maxSpeed || null),
  };

  const details: DataTableColumn<DriverStanding> = {
    key: 'details',
    header: h('details'),
    align: 'right',
    width: '85px',
    cell: (driver) => {
      const isExpanded = !!o.expandedDrivers[driver.participant.car_index];
      return (
        <Button
          size="sm"
          aria-expanded={isExpanded}
          onClick={(e) => {
            // The row itself is a mouse shortcut for this button
            e.stopPropagation();
            o.onToggleDriverExpand(driver.participant.car_index);
          }}
        >
          {t('history.classification.driverLapsCount', { count: driver.laps.length })}
          {isExpanded ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
        </Button>
      );
    },
  };

  return o.isRaceSession
    ? [
        pos,
        driverColumn,
        timeGap,
        laps,
        stints,
        ...(o.showPoints ? [points] : []),
        bestLap,
        sector(0),
        sector(1),
        sector(2),
        topSpeed,
        details,
      ]
    : [pos, driverColumn, bestLap, timeGap, sector(0), sector(1), sector(2), laps, stints, topSpeed, details];
};
