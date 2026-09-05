import React, { useContext, useState } from 'react';
import {
  Flag,
  Users,
  Trophy,
  TrendingUp,
  Layers,
  Zap,
  Sparkles,
  Download,
  Trash2,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  SessionHistoryDataContext,
  SessionHistoryActionsContext,
} from '../../context/SessionHistoryContextDefinitions';
import { formatDate as defaultFormatDate } from '../../utils/formatters';
import { TrackFlag } from '../TrackFlag';
import { F1FormatBadge } from '../F1FormatBadge';
import { SessionTypeBadge } from '../common/SessionTypeBadge';
import { TagBadge } from './TagBadge';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import type { Session } from '../../types/session';

export interface SessionDetailHeaderProps {
  session?: Session;
  isRaceSession?: boolean;
  activeDetailTab?: 'classification' | 'charts' | 'stints' | 'sectors';
  setActiveDetailTab?: (tab: 'classification' | 'charts' | 'stints' | 'sectors') => void;
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
  const historyData = useContext(SessionHistoryDataContext);
  const historyActions = useContext(SessionHistoryActionsContext);
  const [copiedUid, setCopiedUid] = useState(false);

  const session = props.session ?? historyData?.selectedSession;
  if (!session) return null;

  const isRaceSession = props.isRaceSession ?? historyData?.isRaceSession ?? (!!session?.session_type?.toLowerCase().includes('race'));
  const activeDetailTab = props.activeDetailTab ?? historyData?.activeDetailTab;
  const setActiveDetailTab = props.setActiveDetailTab ?? historyActions?.setActiveDetailTab;
  const totalSessionLaps = props.totalSessionLaps ?? historyData?.totalSessionLaps ?? 0;
  const totalDriversCount = props.totalDriversCount ?? historyData?.totalDriversCount ?? 0;
  const onOpenAiDebrief = props.onOpenAiDebrief ?? historyActions?.onOpenAiDebrief;
  const onExportSession = props.onExportSession ?? (() => historyActions?.handleExportSession(session));
  const onRequestDelete = props.onRequestDelete ?? (() => historyActions?.setSessionToDelete(session));
  const onOpenTagManager = props.onOpenTagManager ?? (() => historyActions?.setSessionToManageTags(session));
  const onRemoveTag = props.onRemoveTag ?? ((tagId: number) => historyActions?.handleRemoveTag(session.id, tagId));
  const formatDate = props.formatDate ?? defaultFormatDate;

  const handleCopyUid = () => {
    if (!session?.session_uid) return;
    navigator.clipboard?.writeText(String(session.session_uid));
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <>
      {/* Header Metadata Card */}
      <div className="glass-panel session-header-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {/* Tier 1: Session Identity & Action Buttons */}
        <div className="session-header-top-row">
          <div className="session-header-identity">
            <div className="session-header-title-wrap">
              <TrackFlag track={session.track_name} width={28} height={20} />
              <h1 className="session-header-title">{session.track_name}</h1>
              <F1FormatBadge format={session.packet_format} size="sm" />
              <SessionTypeBadge sessionType={session.session_type} size="sm" />
            </div>
            <div className="session-header-meta-row">
              <span>{formatDate(session.created_at)}</span>
              <span>•</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="mono" style={{ color: 'var(--text-muted)' }}>UID: {session.session_uid}</span>
                <button
                  type="button"
                  className={`session-uid-copy-btn ${copiedUid ? 'copied' : ''}`}
                  onClick={handleCopyUid}
                  title={copiedUid ? t('history.detail.copiedUid') : t('history.detail.copyUid')}
                  aria-label={t('history.detail.copyUid')}
                >
                  {copiedUid ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedUid ? t('common.copied') : ''}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons Group */}
          <div className="session-header-actions">
            {/* AI Race Engineer Debrief Button */}
            <button
              type="button"
              className="session-action-btn-ai"
              onClick={onOpenAiDebrief}
              title={t('history.detail.aiDebrief')}
            >
              <Sparkles size={15} color="#ffd700" />
              <span>{t('history.detail.aiDebrief')}</span>
            </button>

            {/* Export Session Button */}
            <button
              type="button"
              className="session-action-btn-secondary"
              title={t('history.detail.exportThis')}
              onClick={onExportSession}
            >
              <Download size={15} />
              <span>{t('common.export')}</span>
            </button>

            {/* Delete Session Button */}
            <button
              type="button"
              className="session-action-btn-danger"
              title={t('history.detail.deleteThis')}
              onClick={onRequestDelete}
            >
              <Trash2 size={15} />
              <span>{t('common.delete')}</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Tags on the Left, Metrics on the Right */}
        <div className="session-header-bottom-row">
          {/* Session Tags List */}
          <div className="session-header-tags-wrap">
            {(session.tags || []).map((tag) => (
              <TagBadge
                key={tag.id}
                tag={tag}
                size="sm"
                onRemove={() => onRemoveTag(tag.id)}
              />
            ))}

            <button
              type="button"
              onClick={onOpenTagManager}
              className="session-add-tag-btn"
              title={t('history.tags.manageTags')}
            >
              <Plus size={12} />
              <span>{(session.tags || []).length === 0 ? t('history.tags.addTag') : t('history.tags.manageTags')}</span>
            </button>
          </div>

          {/* Metrics / KPI stat boxes */}
          <div className="session-header-stats-wrap">
            <div className="header-stat-box">
              <div>
                <div className="stat-label">{t('history.detail.weather')}</div>
                <WeatherBadgeWithForecast session={session} />
              </div>
            </div>

            <div className="header-stat-box">
              <Flag size={16} color="var(--text-secondary)" />
              <div>
                <div className="stat-label">{t('history.detail.totalLaps')}</div>
                <div className="stat-value mono">{t('history.detail.lapsCount', { count: totalSessionLaps })}</div>
              </div>
            </div>

            <div className="header-stat-box">
              <Users size={16} color="var(--text-secondary)" />
              <div>
                <div className="stat-label">{t('history.detail.drivers')}</div>
                <div className="stat-value mono">{t('history.detail.driversCount', { count: totalDriversCount })}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs inside Session Detail */}
      <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`nav-tab ${activeDetailTab === 'classification' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab?.('classification')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Trophy size={16} />
          <span>{t('history.detail.tabClassification')}</span>
        </button>

        {isRaceSession && (
          <button
            className={`nav-tab ${activeDetailTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveDetailTab?.('charts')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
          >
            <TrendingUp size={16} />
            <span>{t('history.detail.tabProgression')}</span>
          </button>
        )}

        <button
          className={`nav-tab ${activeDetailTab === 'stints' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab?.('stints')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Layers size={16} />
          <span>{t('history.detail.tabStints')}</span>
        </button>

        <button
          className={`nav-tab ${activeDetailTab === 'sectors' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab?.('sectors')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Zap size={16} />
          <span>{t('history.detail.tabSectors')}</span>
        </button>
      </div>
    </>
  );
};
