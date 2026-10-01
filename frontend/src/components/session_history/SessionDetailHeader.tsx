import React, { useContext, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Check,
  Clock,
  Copy,
  Download,
  Flag,
  Layers,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import styles from './SessionDetailHeader.module.css';
import {
  SessionHistoryDataContext,
  SessionHistoryActionsContext,
} from '../../context/SessionHistoryContextDefinitions';
import { TrackFlag } from '../TrackFlag';
import { F1FormatBadge } from '../F1FormatBadge';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { AddTagButton, TagBadge } from './TagBadge';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import type { Session } from '../../types/session';
import { Stat } from '../ui/Stat';
import { Tabs } from '../ui/Tabs';

export type { SessionDetailTab } from '../../router/routes';
import type { SessionDetailTab } from '../../router/routes';
import { useUnits } from '../../hooks/useUnits';

/** Links the detail tabs to the panel `SessionDetailView` renders. */
export const SESSION_DETAIL_TABS_ID = 'session-detail';

export interface SessionDetailHeaderProps {
  session?: Session;
  isRaceSession?: boolean;
  activeDetailTab?: SessionDetailTab;
  setActiveDetailTab?: (tab: SessionDetailTab) => void;
  totalSessionLaps?: number;
  totalDriversCount?: number;
  onOpenAiDebrief?: () => void;
  onExportSession?: () => void;
  onRequestDelete?: () => void;
  onOpenTagManager?: () => void;
  onRemoveTag?: (tagId: number) => void;
  formatDate?: (dateStr: string) => string;
}

export const SessionDetailHeader: React.FC<SessionDetailHeaderProps> = (props) => {
  const { t } = useI18n();
  const units = useUnits();
  const historyData = useContext(SessionHistoryDataContext);
  const historyActions = useContext(SessionHistoryActionsContext);
  const [copiedUid, setCopiedUid] = useState(false);

  const session = props.session ?? historyData?.selectedSession;
  if (!session) return null;

  const isRaceSession =
    props.isRaceSession ?? historyData?.isRaceSession ?? !!session?.session_type?.toLowerCase().includes('race');
  const activeDetailTab = props.activeDetailTab ?? historyData?.activeDetailTab;
  const setActiveDetailTab = props.setActiveDetailTab ?? historyActions?.setActiveDetailTab;
  const totalSessionLaps = props.totalSessionLaps ?? historyData?.totalSessionLaps ?? 0;
  const totalDriversCount = props.totalDriversCount ?? historyData?.totalDriversCount ?? 0;
  const onOpenAiDebrief = props.onOpenAiDebrief ?? historyActions?.onOpenAiDebrief;
  const onExportSession = props.onExportSession ?? (() => historyActions?.handleExportSession(session));
  const onRequestDelete = props.onRequestDelete ?? (() => historyActions?.setSessionToDelete(session));
  const onOpenTagManager = props.onOpenTagManager ?? (() => historyActions?.setSessionToManageTags(session));
  const onRemoveTag = props.onRemoveTag ?? ((tagId: number) => historyActions?.handleRemoveTag(session.id, tagId));
  const formatDate = props.formatDate ?? units.dateAndTime;

  const handleCopyUid = () => {
    if (!session?.session_uid) return;
    navigator.clipboard?.writeText(String(session.session_uid));
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <>
      {/* Header metadata card */}
      <Panel as="div" className={styles.panel}>
        {/* Tier 1: session identity and actions */}
        <div className={styles.topRow}>
          <div className={styles.identity}>
            <div className={styles.titleRow}>
              <TrackFlag track={session.track_name} width={28} height={20} />
              <h1 className={styles.title}>{session.track_name}</h1>
              <F1FormatBadge format={session.packet_format} size="sm" />
              <SessionTypeBadge sessionType={session.session_type} size="sm" />
            </div>
            <div className={styles.meta}>
              <span>{formatDate(session.created_at)}</span>
              <span aria-hidden="true">•</span>
              <div className={styles.uid}>
                <span className={styles.uidText}>UID: {session.session_uid}</span>
                <button
                  type="button"
                  className={styles.copy}
                  data-copied={copiedUid || undefined}
                  onClick={handleCopyUid}
                  title={copiedUid ? t('history.detail.copiedUid') : t('history.detail.copyUid')}
                  aria-label={t('history.detail.copyUid')}
                >
                  {copiedUid ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  <span>{copiedUid ? t('common.copied') : ''}</span>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              className={styles.debrief}
              icon={<Sparkles size={15} className={styles.sparkle} aria-hidden="true" />}
              onClick={onOpenAiDebrief}
            >
              {/* One of the two shows, by width; the hidden one is out of the accessibility tree */}
              <span className={styles.longLabel}>{t('history.detail.aiDebrief')}</span>
              <span className={styles.shortLabel}>{t('history.detail.aiDebriefShort')}</span>
            </Button>
            <Button
              icon={<Download size={15} aria-hidden="true" />}
              title={t('history.detail.exportThis')}
              onClick={onExportSession}
            >
              {t('common.export')}
            </Button>
            <Button
              className={styles.delete}
              icon={<Trash2 size={15} aria-hidden="true" />}
              title={t('history.detail.deleteThis')}
              onClick={onRequestDelete}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>

        {/* Tier 2: tags on the left, figures on the right */}
        <div className={styles.bottomRow}>
          <div className={styles.tags}>
            {(session.tags || []).map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" onRemove={() => onRemoveTag(tag.id)} />
            ))}
            <AddTagButton hasTags={(session.tags || []).length > 0} onClick={onOpenTagManager} />
          </div>

          {/* Metrics / KPI stat boxes */}
          <div className={styles.stats}>
            <Stat
              label={t('history.detail.weather')}
              value={<WeatherBadgeWithForecast session={session} />}
              mono={false}
            />
            <Stat
              icon={<Flag size={16} />}
              label={t('history.detail.totalLaps')}
              value={t('history.detail.lapsCount', { count: totalSessionLaps })}
            />
            <Stat
              icon={<Users size={16} />}
              label={t('history.detail.drivers')}
              value={t('history.detail.driversCount', { count: totalDriversCount })}
            />
          </div>
        </div>
      </Panel>

      {/* Sub-navigation tabs of the session detail */}
      {activeDetailTab && setActiveDetailTab && (
        <Tabs
          idPrefix={SESSION_DETAIL_TABS_ID}
          aria-label={t('history.detail.tabsLabel')}
          className={styles.tabs}
          value={activeDetailTab}
          onChange={setActiveDetailTab}
          items={[
            { id: 'story', label: t('history.detail.tabStory'), icon: <BookOpen size={16} /> },
            { id: 'classification', label: t('history.detail.tabClassification'), icon: <Trophy size={16} /> },
            ...(isRaceSession
              ? [
                  { id: 'pace' as const, label: t('history.detail.tabPace'), icon: <Activity size={16} /> },
                  { id: 'position' as const, label: t('history.detail.tabPosition'), icon: <Award size={16} /> },
                  { id: 'gap' as const, label: t('history.detail.tabGap'), icon: <Clock size={16} /> },
                ]
              : []),
            { id: 'stints', label: t('history.detail.tabStints'), icon: <Layers size={16} /> },
            { id: 'sectors', label: t('history.detail.tabSectors'), icon: <Zap size={16} /> },
          ]}
        />
      )}
    </>
  );
};
