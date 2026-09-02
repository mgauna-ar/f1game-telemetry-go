import React from 'react';
import { Search, Filter, RefreshCw, Upload } from 'lucide-react';
import { TagFilterBar } from './TagFilterBar';
import { useI18n } from '../../context/I18nContext';
import type { Tag } from '../../types/session';

interface SessionFilterToolbarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sessionTypeFilter: string;
  setSessionTypeFilter: (type: string) => void;
  circuitFilter: string;
  setCircuitFilter: (circuit: string) => void;
  uniqueCircuits: string[];
  importingSession: boolean;
  onImportFiles: (files: FileList) => void;
  onRefresh: () => void;
  loadingSessions: boolean;
  availableTags: Tag[];
  selectedTagId: number | null;
  onSelectTag: (tagId: number | null) => void;
  sessionCountByTag: Record<number, number>;
  totalSessionsCount: number;
}

export const SessionFilterToolbar: React.FC<SessionFilterToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  sessionTypeFilter,
  setSessionTypeFilter,
  circuitFilter,
  setCircuitFilter,
  uniqueCircuits,
  importingSession,
  onImportFiles,
  onRefresh,
  loadingSessions,
  availableTags,
  selectedTagId,
  onSelectTag,
  sessionCountByTag,
  totalSessionsCount,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t('history.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 1rem 0.55rem 2.4rem',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Session Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--text-secondary)" />
          <select
            className="ui-select"
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', minWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="ALL">{t('history.allTypes')}</option>
            <option value="Race">{t('history.race')}</option>
            <option value="Sprint">{t('history.sprint')}</option>
            <option value="Qualifying">{t('history.qualifying')}</option>
            <option value="Practice">{t('history.practice')}</option>
          </select>
        </div>

        {/* Circuit Filter */}
        {uniqueCircuits.length > 0 && (
          <select
            className="ui-select"
            value={circuitFilter}
            onChange={(e) => setCircuitFilter(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.4)', minWidth: '150px', fontSize: '0.85rem' }}
          >
            <option value="ALL">{t('history.allCircuits', { count: uniqueCircuits.length })}</option>
            {uniqueCircuits.map((circ) => (
              <option key={circ} value={circ}>
                {circ}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Import & Refresh Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Import Session Button */}
        <label
          className="nav-tab"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            padding: '0.55rem 0.9rem',
            cursor: importingSession ? 'not-allowed' : 'pointer',
            background: 'rgba(0, 242, 254, 0.08)',
            borderColor: 'rgba(0, 242, 254, 0.3)',
            color: 'var(--accent-secondary)',
          }}
          title={t('history.importDropPrompt')}
        >
          <input
            type="file"
            multiple
            accept=".f1session,.zip"
            style={{ display: 'none' }}
            disabled={importingSession}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onImportFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          {importingSession ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> {t('history.importing')}
            </>
          ) : (
            <>
              <Upload size={14} /> {t('history.importSession')}
            </>
          )}
        </label>

        <button
          className="nav-tab"
          onClick={onRefresh}
          disabled={loadingSessions}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '0.55rem 0.9rem' }}
        >
          <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} /> {t('common.refresh')}
        </button>
      </div>

      {/* Tag Filter Bar Strip */}
      {availableTags.length > 0 && (
        <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem', marginTop: '0.25rem' }}>
          <TagFilterBar
            availableTags={availableTags}
            selectedTagId={selectedTagId}
            onSelectTag={onSelectTag}
            sessionCountByTag={sessionCountByTag}
            totalSessionsCount={totalSessionsCount}
          />
        </div>
      )}
    </div>
  );
};
