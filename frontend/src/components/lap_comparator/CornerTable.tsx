import React, { useMemo, useState } from 'react';
import { Crosshair, Sparkles } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { CornerAnalysis, CornerMetrics } from '../../utils/trackTurns';
import { DataTable, type DataTableColumn, type SortState } from '../ui/DataTable';
import { IconButton } from '../ui/Button';
import { Panel, PanelHeader } from '../ui/Panel';
import styles from './CornerTable.module.css';
import { useUnits } from '../../hooks/useUnits';

export interface CornerTableProps {
  corners: CornerAnalysis[];
  nameA: string;
  nameB: string;
  /** The zoomed stretch, to mark the corner it shows. */
  zoomDomain: [number, number] | null;
  /** Zoom the charts and the map to a corner. */
  onZoom: (corner: CornerAnalysis) => void;
  /** Ask the AI engineer about a corner, with its stretch as the chat's zoom. */
  onAskAi: (corner: CornerAnalysis) => void;
}

type SortKey = 'turn' | 'time';

/** Which lap does better on a number, when higher is better; undefined when they tie or one is missing. */
const higherIsBetter = (a: number | null, b: number | null): 'a' | 'b' | undefined => {
  if (a === null || b === null || a === b) return undefined;
  return a > b ? 'a' : 'b';
};

const signed = (value: number, digits = 0) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;

/**
 * "Where did I lose time": one row per corner with both laps' entry and minimum speed, braking
 * point and throttle pickup, and the time lap A gained or lost there. A row zooms the charts and
 * the map to that corner; "Ask AI" sends the corner's stretch to the chat as its zoom.
 */
export const CornerTable: React.FC<CornerTableProps> = ({ corners, nameA, nameB, zoomDomain, onZoom, onAskAi }) => {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'turn', direction: 'asc' });

  const rows = useMemo(() => {
    const byTurn = (x: CornerAnalysis, y: CornerAnalysis) => x.turn.distance - y.turn.distance;
    const byTime = (x: CornerAnalysis, y: CornerAnalysis) =>
      (x.timeDelta ?? -Infinity) - (y.timeDelta ?? -Infinity) || byTurn(x, y);
    const sorted = [...corners].sort(sort.key === 'time' ? byTime : byTurn);
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [corners, sort]);

  const worst = useMemo(
    () =>
      corners.reduce<CornerAnalysis | null>(
        (max, c) => (c.timeDelta !== null && c.timeDelta > 0 && (!max || c.timeDelta > max.timeDelta!) ? c : max),
        null
      ),
    [corners]
  );

  const isZoomed = (c: CornerAnalysis) =>
    zoomDomain !== null && zoomDomain[0] === c.range[0] && zoomDomain[1] === c.range[1];

  const speedUnits = useUnits();
  const units = { m: t('comparator.corners.meters') };

  /** Both laps' values, lap A on top, in the slot colours; `better` marks the faster one. */
  const pair = (
    corner: CornerAnalysis,
    value: (m: CornerMetrics) => number | null,
    format: (v: number) => string,
    better?: 'a' | 'b'
  ) => (
    <span className={styles.pair}>
      {(['a', 'b'] as const).map((slot) => {
        const v = value(corner[slot]);
        return (
          <span key={slot} data-slot={slot} data-better={better === slot || undefined}>
            <span className="sr-only">{slot === 'a' ? nameA : nameB}: </span>
            {v === null ? '—' : format(v)}
          </span>
        );
      })}
    </span>
  );

  const columns: DataTableColumn<CornerAnalysis>[] = [
    {
      key: 'turn',
      header: t('comparator.corners.turn'),
      sortable: true,
      rowHeader: true,
      width: '64px',
      cell: (c) => (
        <button
          type="button"
          className={`button-reset ${styles.turnButton}`}
          aria-pressed={isZoomed(c)}
          title={t('comparator.corners.zoomTo', { turn: c.turn.name, from: c.range[0], to: c.range[1] })}
          onClick={(e) => {
            e.stopPropagation();
            onZoom(c);
          }}
        >
          <Crosshair size={12} aria-hidden="true" />
          {c.turn.name}
        </button>
      ),
    },
    {
      key: 'entry',
      header: t('comparator.corners.entrySpeed', { unit: speedUnits.speedUnit }),
      numeric: true,
      cell: (c) =>
        pair(
          c,
          (m) => m.entrySpeed,
          (v) => speedUnits.speedValue(v).toFixed(0),
          higherIsBetter(c.a.entrySpeed, c.b.entrySpeed)
        ),
    },
    {
      key: 'min',
      header: t('comparator.corners.minSpeed', { unit: speedUnits.speedUnit }),
      numeric: true,
      cell: (c) =>
        pair(
          c,
          (m) => m.minSpeed,
          (v) => speedUnits.speedValue(v).toFixed(0),
          higherIsBetter(c.a.minSpeed, c.b.minSpeed)
        ),
    },
    {
      key: 'braking',
      header: t('comparator.corners.braking'),
      numeric: true,
      cell: (c) =>
        pair(
          c,
          (m) => m.brakingBeforeApex,
          (v) => `${v} ${units.m}`
        ),
    },
    {
      key: 'throttle',
      header: t('comparator.corners.throttle'),
      numeric: true,
      cell: (c) =>
        pair(
          c,
          (m) => m.throttleFromApex,
          (v) => `${signed(v)} ${units.m}`
        ),
    },
    {
      key: 'time',
      header: t('comparator.corners.time'),
      sortable: true,
      numeric: true,
      cell: (c) =>
        c.timeDelta === null ? (
          '—'
        ) : (
          <span
            className={styles.delta}
            data-faster={c.timeDelta < 0 ? 'a' : c.timeDelta > 0 ? 'b' : undefined}
            title={
              c.timeDelta > 0
                ? t('comparator.corners.lost', { name: nameA })
                : t('comparator.corners.gained', { name: nameA })
            }
          >
            {signed(c.timeDelta, 3)}
            {t('comparator.corners.seconds')}
          </span>
        ),
    },
    {
      key: 'ask',
      header: <span className="sr-only">{t('comparator.corners.askAiHeader')}</span>,
      align: 'right',
      width: '44px',
      cell: (c) => (
        <IconButton
          size="sm"
          variant="ghost"
          label={t('comparator.corners.askAi', { turn: c.turn.name })}
          onClick={(e) => {
            e.stopPropagation();
            onAskAi(c);
          }}
        >
          <Sparkles size={14} aria-hidden="true" />
        </IconButton>
      ),
    },
  ];

  return (
    <Panel padding="compact" className={styles.panel}>
      <PanelHeader
        level={2}
        icon={<Crosshair size={16} />}
        title={t('comparator.corners.title')}
        subtitle={
          worst
            ? t('comparator.corners.worst', {
                name: nameA,
                turn: worst.turn.name,
                delta: worst.timeDelta!.toFixed(3),
              })
            : t('comparator.corners.subtitle')
        }
        actions={
          <span className={styles.legend} aria-hidden="true">
            <span data-slot="a">{nameA}</span>
            <span data-slot="b">{nameB}</span>
          </span>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => c.turn.name}
        caption={t('comparator.corners.caption', { a: nameA, b: nameB })}
        density="compact"
        sort={sort}
        onSortChange={(key) =>
          setSort((prev) => ({
            key: key as SortKey,
            // Time starts with the biggest loss; turns in lap order
            direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : key === 'time' ? 'desc' : 'asc',
          }))
        }
        onRowClick={onZoom}
        getRowClassName={(c) => (isZoomed(c) ? styles.zoomed : undefined)}
      />
    </Panel>
  );
};
