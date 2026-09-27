import React, { useMemo, useState } from 'react';
import { getTeamColor, getVisualCompoundId } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import { styleVars } from '../../../styles/theme';
import type { DriverStanding, DriverStint } from '../../../types/session';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { Badge } from '../../ui/Badge';
import { DataTable, type DataTableColumn, type SortState } from '../../ui/DataTable';
import styles from './DegradationTable.module.css';
import { describeExcludedLaps } from './stintUtils';

/** One stint of one driver, a row of the table. */
export interface DegradationTableRow {
  key: string;
  driver: DriverStanding;
  stint: DriverStint;
}

type SortKey = 'driver' | 'tyre' | 'laps' | 'rate' | 'avg' | 'best';

interface DegradationTableProps {
  rows: DegradationTableRow[];
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
  formatLapTime: (ms: number) => string;
  playerCarIndex: number | null;
}

/** A value to sort by; null sorts last in either direction. */
const sortValue = (row: DegradationTableRow, key: SortKey): number | null => {
  const { stint, driver } = row;
  switch (key) {
    case 'driver':
      return (driver.position || 999) * 100 + stint.stintIndex;
    case 'tyre':
      return getVisualCompoundId(stint.compound) ?? null;
    case 'laps':
      return stint.fitLaps;
    case 'rate':
      return stint.degSlopeSecPerLap ?? null;
    case 'avg':
      return stint.fitLaps > 0 ? stint.avgLapTimeMS : null;
    case 'best':
      return stint.bestLapTimeMS > 0 ? stint.bestLapTimeMS : null;
  }
};

function sortDegradationRows(rows: readonly DegradationTableRow[], sort: SortState<SortKey>) {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (va !== vb) {
      return (va - vb) * sign;
    }
    return sortValue(a, 'driver')! - sortValue(b, 'driver')!;
  });
}

/**
 * The degradation of every stint in a sortable table: the laps the fit uses (and those it leaves
 * out, and why), the rate, the clean average and the best lap. The first column picks the stints
 * the chart shows.
 */
export const DegradationTable: React.FC<DegradationTableProps> = ({
  rows,
  selected,
  onToggle,
  formatLapTime,
  playerCarIndex,
}) => {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'driver', direction: 'asc' });
  const sorted = useMemo(() => sortDegradationRows(rows, sort), [rows, sort]);
  const reason = (r: string) => t(`history.stints.degradation.reasons.${r}`);
  const h = (key: string) => t(`history.stints.degradation.${key}`);

  const columns: DataTableColumn<DegradationTableRow>[] = [
    {
      key: 'chart',
      header: <span className="sr-only">{h('colChart')}</span>,
      width: '40px',
      cell: ({ key, driver, stint }) => (
        <span
          className={styles.pick}
          style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}
          data-later={stint.stintIndex > 1 || undefined}
        >
          <input
            type="checkbox"
            checked={!!selected[key]}
            onChange={() => onToggle(key)}
            // The row click toggles too, so the checkbox's own click stops here
            onClick={(e) => e.stopPropagation()}
            aria-label={t('history.stints.degradation.showStint', {
              driver: driver.participant.name,
              stint: stint.stintIndex,
            })}
          />
          <span className={styles.swatch} aria-hidden="true" />
        </span>
      ),
    },
    {
      key: 'driver',
      header: h('colDriver'),
      sortable: true,
      rowHeader: true,
      cell: ({ driver }) => (
        <span className={styles.driver}>
          <span className={styles.pos}>P{driver.position}</span>
          <span className={styles.name}>{driver.participant.name}</span>
          {driver.participant.car_index === playerCarIndex && (
            <Badge tone="accent" size="xs" className={styles.youBadge}>
              {t('history.player.you')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'stint',
      header: h('colStint'),
      className: styles.stintCol,
      cell: ({ stint }) => (
        <span className={styles.muted}>
          {t('history.stints.degradation.stintLaps', {
            stint: stint.stintIndex,
            start: stint.startLap,
            end: stint.endLap,
          })}
        </span>
      ),
    },
    {
      key: 'tyre',
      header: h('colTyre'),
      sortable: true,
      align: 'center',
      cell: ({ stint }) => <TyreCompoundBadge compound={stint.compound} />,
    },
    {
      key: 'rate',
      header: h('colRate'),
      sortable: true,
      numeric: true,
      cell: ({ stint }) => {
        const rate = stint.degSlopeSecPerLap;
        if (rate === null || rate === undefined) {
          return (
            <span className={styles.muted} title={h('noRate')}>
              —<span className="sr-only"> {h('noRate')}</span>
            </span>
          );
        }
        const value = Math.abs(rate).toFixed(3);
        // The server rounds to the millisecond, so a flat stint is exactly 0
        if (rate === 0) {
          return (
            <span className={styles.muted}>
              <span aria-hidden="true">{h('rateFlat')}</span>
              <span className="sr-only">{h('rateFlatLong')}</span>
            </span>
          );
        }
        return (
          <span className={rate > 0 ? styles.degrading : styles.improving}>
            <span aria-hidden="true">
              {t(rate > 0 ? 'history.stints.degradation.rateUp' : 'history.stints.degradation.rateDown', {
                rate: value,
              })}
            </span>
            <span className="sr-only">
              {t(rate > 0 ? 'history.stints.degradation.rateUpLong' : 'history.stints.degradation.rateDownLong', {
                rate: value,
              })}
            </span>
          </span>
        );
      },
    },
    {
      key: 'laps',
      header: h('colFitLaps'),
      sortable: true,
      numeric: true,
      cell: ({ stint }) => {
        const leftOut = stint.excludedLaps.length
          ? t('history.stints.degradation.leftOut', {
              laps: describeExcludedLaps(stint, reason, h('lapPrefix')),
            })
          : h('everyLapUsed');
        const timed = stint.fitLaps + stint.excludedLaps.length;
        if (timed === 0) return <span className={styles.muted}>—</span>;
        return (
          <span className={styles.laps} title={leftOut}>
            {t('history.stints.degradation.fitLaps', { fit: stint.fitLaps, total: timed })}
            <span className={styles.leftOut}>{leftOut}</span>
          </span>
        );
      },
    },
    {
      key: 'avg',
      header: h('colAvg'),
      sortable: true,
      numeric: true,
      className: styles.avgCol,
      cell: ({ stint }) => (stint.fitLaps > 0 ? formatLapTime(stint.avgLapTimeMS) : '—'),
    },
    {
      key: 'best',
      header: h('colBest'),
      sortable: true,
      numeric: true,
      className: styles.bestCol,
      cell: ({ stint }) => (stint.bestLapTimeMS > 0 ? formatLapTime(stint.bestLapTimeMS) : '—'),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={sorted}
      getRowKey={(r) => r.key}
      caption={h('tableCaption')}
      density="compact"
      stickyHeader
      className={styles.scroll}
      sort={sort}
      onSortChange={(key) =>
        setSort((prev) => ({
          key: key as SortKey,
          direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc',
        }))
      }
      onRowClick={(r) => onToggle(r.key)}
      getRowClassName={(r) =>
        [
          selected[r.key] ? styles.selected : undefined,
          r.driver.participant.car_index === playerCarIndex ? styles.you : undefined,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
    />
  );
};
