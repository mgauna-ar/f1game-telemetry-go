import React from 'react';
import { ChevronRight, GitCompare, List } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { navigate, openComparator } from '../../router/router';
import { buildPath } from '../../router/routes';
import { maxWidth } from '../../styles/breakpoints';
import type { ProgressSession } from '../../types/progress';
import { formatLapTime, formatSectorTime } from '../../utils/formatters';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { F1FormatBadge } from '../F1FormatBadge';
import { commonPacketFormat } from '../session_history/packetFormat';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/Button';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { Panel, PanelHeader } from '../ui/Panel';
import {
  formatChange,
  formatSpread,
  progressBests,
  SECTOR_KEYS,
  shortDateTime,
  type ProgressBests,
  type SectorKey,
} from './progressStats';
import styles from './ProgressSessionsTable.module.css';

const sessionPath = (s: ProgressSession) =>
  buildPath({ page: 'history', sessionId: s.session_id, tab: 'story' });

interface CellProps {
  s: ProgressSession;
}

const SessionCell: React.FC<CellProps & { usualFormat?: number }> = ({ s, usualFormat }) => {
  const { t } = useI18n();
  return (
    <span className={styles.session}>
      {s.packet_format !== usualFormat && <F1FormatBadge format={s.packet_format} size="xs" />}
      <SessionTypeBadge sessionType={s.session_type} size="xs" showIcon={false} />
      {s.source === 'chosen' && (
        <span className={styles.byName} title={t('progress.table.foundByName')}>
          *<span className="sr-only">{t('progress.table.foundByName')}</span>
        </span>
      )}
    </span>
  );
};

const ResultCell: React.FC<CellProps> = ({ s }) =>
  s.position > 0 ? (
    <span className={styles.result}>
      P{s.position}
      <span className={styles.of}>/{s.classified_cars}</span>
    </span>
  ) : (
    <>—</>
  );

const BestLapCell: React.FC<CellProps & { bests: ProgressBests }> = ({ s, bests }) => {
  const { t } = useI18n();
  const isPB = bests.bestLap?.session_id === s.session_id;
  return (
    <span className={styles.lap}>
      <span className={isPB ? styles.personalBest : undefined}>{formatLapTime(s.best_lap_time_ms)}</span>
      {isPB && (
        <Badge tone="purple" size="xs" title={t('progress.table.personalBest')}>
          {t('progress.table.pb')}
          <span className="sr-only"> {t('progress.table.personalBest')}</span>
        </Badge>
      )}
    </span>
  );
};

const SectorCell: React.FC<CellProps & { bests: ProgressBests; sector: SectorKey }> = ({ s, bests, sector }) => {
  const { t } = useI18n();
  const isBest = s[sector] > 0 && s[sector] === bests.sectors[sector];
  return (
    <span
      className={isBest ? styles.personalBest : styles.sector}
      title={isBest ? t('progress.table.bestSector') : undefined}
    >
      {formatSectorTime(s[sector], false)}
      {isBest && <span className="sr-only"> ({t('progress.table.bestSector')})</span>}
    </span>
  );
};

const GapCell: React.FC<CellProps> = ({ s }) => {
  const { t } = useI18n();
  if (s.gap_to_fastest_ms === null) return <span className={styles.muted}>—</span>;
  if (s.gap_to_fastest_ms === 0) {
    return (
      <Badge tone="purple" size="xs" title={t('progress.stats.fastest')}>
        {t('progress.table.fastest')}
      </Badge>
    );
  }
  return (
    <span className={styles.gap} title={s.fastest_driver_name}>
      {formatChange(s.gap_to_fastest_ms)}
    </span>
  );
};

const ConsistencyCell: React.FC<CellProps> = ({ s }) => {
  const { t } = useI18n();
  if (s.consistency_ms === null) return <span className={styles.muted}>—</span>;
  return <span title={t('progress.charts.cleanLaps', { count: s.clean_laps })}>{formatSpread(s.consistency_ms)}</span>;
};

const Actions: React.FC<CellProps> = ({ s }) => {
  const { t } = useI18n();
  return (
    <div className={styles.actions}>
      {s.best_lap_id > 0 && s.fastest_lap_id > 0 && s.fastest_lap_id !== s.best_lap_id && (
        <IconButton
          size="sm"
          variant="secondary"
          label={t('progress.table.compare')}
          onClick={(e) => {
            e.stopPropagation();
            openComparator({ sessionA: s.session_id, lapA: s.best_lap_id, lapB: s.fastest_lap_id });
          }}
        >
          <GitCompare size={14} />
        </IconButton>
      )}
      <IconButton
        size="sm"
        label={t('progress.table.open')}
        onClick={(e) => {
          e.stopPropagation();
          navigate(sessionPath(s));
        }}
      >
        <ChevronRight size={16} />
      </IconButton>
    </div>
  );
};

/**
 * One row per session, newest first, with your personal best and best sectors marked. On a phone,
 * where its ten columns don't fit, one card per session instead.
 */
export const ProgressSessionsTable: React.FC<{ sessions: ProgressSession[]; track: string }> = ({
  sessions,
  track,
}) => {
  const { t, locale } = useI18n();
  const isPhone = useMediaQuery(maxWidth('phone'));
  const bests = progressBests(sessions);
  const usualFormat = commonPacketFormat(sessions);
  const rows = [...sessions].reverse();
  const title = t('progress.table.caption', { track });

  const columns: DataTableColumn<ProgressSession>[] = [
    {
      key: 'date',
      header: t('progress.table.date'),
      rowHeader: true,
      cell: (s) => <span className={styles.date}>{shortDateTime(s.created_at, locale)}</span>,
    },
    {
      key: 'session',
      header: t('progress.table.session'),
      cell: (s) => <SessionCell s={s} usualFormat={usualFormat} />,
    },
    { key: 'result', header: t('progress.table.result'), numeric: true, cell: (s) => <ResultCell s={s} /> },
    {
      key: 'best',
      header: t('progress.table.bestLap'),
      numeric: true,
      cell: (s) => <BestLapCell s={s} bests={bests} />,
    },
    ...SECTOR_KEYS.map((key, i): DataTableColumn<ProgressSession> => ({
      key,
      header: `S${i + 1}`,
      numeric: true,
      cell: (s) => <SectorCell s={s} bests={bests} sector={key} />,
    })),
    { key: 'gap', header: t('progress.table.gap'), numeric: true, cell: (s) => <GapCell s={s} /> },
    {
      key: 'consistency',
      header: t('progress.table.consistency'),
      numeric: true,
      cell: (s) => <ConsistencyCell s={s} />,
    },
    { key: 'actions', header: t('progress.table.actions'), align: 'right', cell: (s) => <Actions s={s} /> },
  ];

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        level={2}
        icon={<List size={18} />}
        title={title}
        subtitle={sessions.some((s) => s.source === 'chosen') ? `* ${t('progress.table.foundByName')}` : undefined}
      />
      {isPhone ? (
        <ul className={styles.cards} aria-label={title}>
          {rows.map((s) => (
            <li key={s.session_id} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.date}>{shortDateTime(s.created_at, locale)}</span>
                <SessionCell s={s} usualFormat={usualFormat} />
                <span className={styles.cardResult}>
                  <ResultCell s={s} />
                </span>
              </div>
              <dl className={styles.cardStats}>
                <div>
                  <dt>{t('progress.table.bestLap')}</dt>
                  <dd>
                    <BestLapCell s={s} bests={bests} />
                  </dd>
                </div>
                <div>
                  <dt>{t('progress.table.gap')}</dt>
                  <dd>
                    <GapCell s={s} />
                  </dd>
                </div>
                <div>
                  <dt>{t('progress.table.consistency')}</dt>
                  <dd>
                    <ConsistencyCell s={s} />
                  </dd>
                </div>
                {SECTOR_KEYS.map((key, i) => (
                  <div key={key}>
                    <dt>S{i + 1}</dt>
                    <dd>
                      <SectorCell s={s} bests={bests} sector={key} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Actions s={s} />
            </li>
          ))}
        </ul>
      ) : (
        <DataTable
          caption={title}
          columns={columns}
          rows={rows}
          getRowKey={(s) => s.session_id}
          onRowClick={(s) => navigate(sessionPath(s))}
          density="compact"
        />
      )}
    </Panel>
  );
};
