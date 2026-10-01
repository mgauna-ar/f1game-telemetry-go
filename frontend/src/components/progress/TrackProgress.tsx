import React, { useId, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTrackProgress } from '../../hooks/useTrackProgress';
import { useRoute, navigate } from '../../router/router';
import { Link } from '../../router/Link';
import { buildPath } from '../../router/routes';
import type { ProgressSession } from '../../types/progress';
import { formatLapTime } from '../../utils/formatters';
import { sessionTypeLabel } from '../../utils/sessionTypeLabel';
import { TrackFlag } from '../TrackFlag';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Field';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SkeletonGroup, SkeletonRows } from '../ui/Skeleton';
import { Stat } from '../ui/Stat';
import { cx } from '../ui/cx';
import { ProgressCharts } from './ProgressCharts';
import { ProgressSessionsTable } from './ProgressSessionsTable';
import {
  filterByKind,
  formatChange,
  formatSpread,
  latestAndChange,
  presentKinds,
  progressBests,
  shortDate,
  type ProgressKindFilter,
} from './progressStats';
import styles from './TrackProgress.module.css';

/** `/progress[/:track]`: your pace at one track across its sessions. */
export const TrackProgress: React.FC = () => {
  const { t } = useI18n();
  const route = useRoute();
  const track = route.page === 'progress' ? route.track : undefined;
  const { data, loading, error, reload } = useTrackProgress(track);
  const [kind, setKind] = useState<ProgressKindFilter>('all');
  const trackSelectId = useId();

  const allSessions = useMemo(() => data?.sessions ?? [], [data]);
  const kinds = useMemo(() => presentKinds(allSessions), [allSessions]);
  const activeKind: ProgressKindFilter = kind !== 'all' && kinds.includes(kind) ? kind : 'all';
  const sessions = useMemo(() => filterByKind(allSessions, activeKind), [allSessions, activeKind]);

  const shownTrack = data?.track ?? track ?? '';
  const tracks = data?.tracks ?? [];
  useDocumentTitle(shownTrack ? `${t('progress.title')}: ${shownTrack}` : t('progress.title'));

  const header = (
    <PageHeader
      icon={<TrendingUp />}
      title={t('progress.title')}
      subtitle={t('progress.subtitle')}
      aside={
        tracks.length > 0 && (
          <>
            <div className={styles.trackPicker}>
              <label htmlFor={trackSelectId} className={styles.controlLabel}>
                {t('progress.trackLabel')}
              </label>
              <div className={styles.trackSelect}>
                <TrackFlag track={shownTrack} width={20} height={14} />
                <Select
                  id={trackSelectId}
                  value={shownTrack}
                  onChange={(e) => navigate(buildPath({ page: 'progress', track: e.target.value }))}
                >
                  {tracks.map((tr) => (
                    <option key={tr.track_name} value={tr.track_name}>
                      {t('progress.trackOption', { track: tr.track_name, count: tr.sessions })}
                    </option>
                  ))}
                  {/* A track from the URL that has no sessions */}
                  {!tracks.some((tr) => tr.track_name === shownTrack) && (
                    <option value={shownTrack}>{shownTrack}</option>
                  )}
                </Select>
              </div>
            </div>
            {kinds.length > 1 && (
              <SegmentedControl
                aria-label={t('progress.kindLabel')}
                value={activeKind}
                onChange={setKind}
                options={[
                  { value: 'all', label: t('progress.kinds.all') },
                  ...kinds.map((k) => ({ value: k, label: t(`progress.kinds.${k}`) })),
                ]}
              />
            )}
          </>
        )
      }
    />
  );

  let body: React.ReactNode;
  if (loading && !data) {
    body = (
      <Panel as="div">
        <SkeletonGroup label={t('progress.loading')}>
          <SkeletonRows rows={6} />
        </SkeletonGroup>
      </Panel>
    );
  } else if (error && !data) {
    body = (
      <EmptyState
        tone="danger"
        title={t('progress.loadError')}
        description={error}
        action={<Button onClick={reload}>{t('common.retry')}</Button>}
      />
    );
  } else if (tracks.length === 0) {
    body = (
      <EmptyState
        icon={<TrendingUp size={32} />}
        title={t('progress.noSessions')}
        description={t('progress.noSessionsHint')}
      />
    );
  } else {
    body = (
      <>
        {data && data.unmatched_sessions > 0 && (
          <p className={styles.unmatched} role="note">
            {data.unmatched_sessions === 1
              ? t('progress.unmatchedOne')
              : t('progress.unmatchedMany', { count: data.unmatched_sessions })}{' '}
            <Link
              className={styles.unmatchedLink}
              href={buildPath({
                page: 'history',
                tab: 'story',
                listFilter: { quick: 'noDriver', track: data.track },
              })}
            >
              {t(data.unmatched_sessions === 1 ? 'progress.unmatchedLinkOne' : 'progress.unmatchedLinkMany')}
            </Link>
          </p>
        )}
        {sessions.length === 0 ? (
          <EmptyState
            title={t(activeKind === 'all' ? 'progress.noneAtTrack' : 'progress.noneForKind', { track: shownTrack })}
          />
        ) : (
          <div className={styles.content} aria-busy={loading || undefined}>
            <ProgressStats sessions={sessions} />
            <ProgressCharts sessions={sessions} />
            <ProgressSessionsTable sessions={sessions} track={shownTrack} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      {header}
      {body}
    </div>
  );
};

/** The headline figures: personal best, theoretical best, and the latest gap and consistency. */
const ProgressStats: React.FC<{ sessions: ProgressSession[] }> = ({ sessions }) => {
  const { t, locale } = useI18n();
  const bests = progressBests(sessions);
  const gap = latestAndChange(sessions, (s) => s.gap_to_fastest_ms);
  const consistency = latestAndChange(sessions, (s) => s.consistency_ms);

  const change = (value?: number) =>
    value === undefined ? undefined : t('progress.stats.change', { change: formatChange(value) });

  return (
    <div className={styles.stats}>
      <Stat
        className={styles.stat}
        valueClassName={cx(styles.statValue, styles.best)}
        label={t('progress.stats.personalBest')}
        value={formatLapTime(bests.bestLap?.best_lap_time_ms)}
        detail={
          bests.bestLap &&
          `${sessionTypeLabel(bests.bestLap.session_type, t)} · ${shortDate(bests.bestLap.created_at, locale)}`
        }
      />
      <Stat
        className={styles.stat}
        valueClassName={styles.statValue}
        label={t('progress.stats.theoretical')}
        value={formatLapTime(bests.theoreticalMS)}
        detail={t('progress.stats.theoreticalDetail')}
      />
      <Stat
        className={styles.stat}
        valueClassName={styles.statValue}
        label={t('progress.stats.gap')}
        value={
          gap.latestValue === undefined
            ? '—'
            : gap.latestValue === 0
              ? t('progress.stats.fastest')
              : formatChange(gap.latestValue)
        }
        detail={change(gap.change) ?? t('progress.stats.gapDetail')}
      />
      <Stat
        className={styles.stat}
        valueClassName={styles.statValue}
        label={t('progress.stats.consistency')}
        value={consistency.latestValue === undefined ? '—' : formatSpread(consistency.latestValue)}
        detail={
          change(consistency.change) ??
          (consistency.latest
            ? t('progress.stats.consistencyDetail', { count: consistency.latest.clean_laps })
            : t('progress.charts.noConsistency'))
        }
      />
    </div>
  );
};
