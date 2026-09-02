import React from 'react';
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
} from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContext';
import { formatDate as defaultFormatDate, getSessionBadgeClass as defaultGetSessionBadgeClass } from '../../utils/formatters';
import { TrackFlag } from '../TrackFlag';
import { F1FormatBadge } from '../F1FormatBadge';
import { TagBadge } from './TagBadge';
import { WeatherBadgeWithForecast } from './WeatherBadgeWithForecast';
import type { Session } from '../../types/session';

export interface SessionDetailHeaderProps {
  session?: Session;
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
  getSessionBadgeClass?: (type: string) => string;
}

export const SessionDetailHeader: React.FC<SessionDetailHeaderProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const session = props.session ?? historyData.selectedSession;
  if (!session) return null;

  const activeDetailTab = props.activeDetailTab ?? historyData.activeDetailTab;
  const setActiveDetailTab = props.setActiveDetailTab ?? historyActions.setActiveDetailTab;
  const totalSessionLaps = props.totalSessionLaps ?? historyData.totalSessionLaps;
  const totalDriversCount = props.totalDriversCount ?? historyData.totalDriversCount;
  const onOpenAiDebrief = props.onOpenAiDebrief ?? historyActions.onOpenAiDebrief;
  const onExportSession = props.onExportSession ?? (() => historyActions.handleExportSession(session));
  const onRequestDelete = props.onRequestDelete ?? (() => historyActions.setSessionToDelete(session));
  const onOpenTagManager = props.onOpenTagManager ?? (() => historyActions.setSessionToManageTags(session));
  const onRemoveTag = props.onRemoveTag ?? ((tagId: number) => historyActions.handleRemoveTag(session.id, tagId));
  const formatDate = props.formatDate ?? defaultFormatDate;
  const getSessionBadgeClass = props.getSessionBadgeClass ?? defaultGetSessionBadgeClass;

  return (
    <>
      {/* Header Metadata Card */}
      <div className="glass-panel session-header-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <TrackFlag track={session.track_name} width={26} height={18} />
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>{session.track_name}</h1>
            <F1FormatBadge format={session.packet_format} size="sm" />
            <span className={`badge ${getSessionBadgeClass(session.session_type)}`} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {session.session_type || 'Unknown'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span>{formatDate(session.created_at)}</span>
            <span>•</span>
            <span className="mono" style={{ color: 'var(--text-muted)' }}>UID: {session.session_uid}</span>
          </div>

          {/* Session Tags List */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '0.6rem' }}>
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

          {/* AI Race Engineer Debrief Button */}
          <button
            className="nav-tab active"
            onClick={onOpenAiDebrief}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.6rem 1rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(176, 38, 255, 0.25))',
              borderColor: 'rgba(0, 242, 254, 0.4)',
              color: '#fff',
            }}
          >
            <Sparkles size={15} color="#ffd700" /> {t('history.detail.aiDebrief')}
          </button>

          {/* Export Session Button */}
          <button
            className="nav-tab"
            title={t('history.detail.exportThis')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.6rem 1rem',
              color: 'var(--accent-secondary)',
              borderColor: 'rgba(0, 242, 254, 0.3)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
            onClick={onExportSession}
          >
            <Download size={15} /> {t('common.export')}
          </button>

          <button
            className="nav-tab"
            title={t('history.detail.deleteThis')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.6rem 1rem',
              color: '#ff4d4f',
              borderColor: 'rgba(255, 77, 79, 0.3)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
            onClick={onRequestDelete}
          >
            <Trash2 size={15} /> {t('common.delete')}
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs inside Session Detail */}
      <div className="glass-panel" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          className={`nav-tab ${activeDetailTab === 'classification' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('classification')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Trophy size={16} />
          <span>{t('history.detail.tabClassification')}</span>
        </button>

        <button
          className={`nav-tab ${activeDetailTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('charts')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <TrendingUp size={16} />
          <span>{t('history.detail.tabProgression')}</span>
        </button>

        <button
          className={`nav-tab ${activeDetailTab === 'stints' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('stints')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Layers size={16} />
          <span>{t('history.detail.tabStints')}</span>
        </button>

        <button
          className={`nav-tab ${activeDetailTab === 'sectors' ? 'active' : ''}`}
          onClick={() => setActiveDetailTab('sectors')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
        >
          <Zap size={16} />
          <span>{t('history.detail.tabSectors')}</span>
        </button>
      </div>
    </>
  );
};
