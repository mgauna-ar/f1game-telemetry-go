import React from 'react';
import { Search, RefreshCw, Upload, X, Trophy, MapPin, RotateCcw } from 'lucide-react';
import { TagFilterBar } from './TagFilterBar';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import type { Tag } from '../../types/session';

export interface SessionFilterToolbarProps {
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  sessionTypeFilter?: string;
  setSessionTypeFilter?: (type: string) => void;
  circuitFilter?: string;
  setCircuitFilter?: (circuit: string) => void;
  uniqueCircuits?: string[];
  importingSession?: boolean;
  onImportFiles?: (files: FileList | File[]) => void;
  onRefresh?: () => void;
  loadingSessions?: boolean;
  availableTags?: Tag[];
  selectedTagId?: number | null;
  onSelectTag?: (tagId: number | null) => void;
  sessionCountByTag?: Record<number, number>;
  totalSessionsCount?: number;
}

export const SessionFilterToolbar: React.FC<SessionFilterToolbarProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const searchQuery = props.searchQuery ?? historyData.searchQuery;
  const setSearchQuery = props.setSearchQuery ?? historyActions.setSearchQuery;
  const sessionTypeFilter = props.sessionTypeFilter ?? historyData.sessionTypeFilter;
  const setSessionTypeFilter = props.setSessionTypeFilter ?? historyActions.setSessionTypeFilter;
  const circuitFilter = props.circuitFilter ?? historyData.circuitFilter;
  const setCircuitFilter = props.setCircuitFilter ?? historyActions.setCircuitFilter;
  const uniqueCircuits = props.uniqueCircuits ?? historyData.uniqueCircuits;
  const importingSession = props.importingSession ?? historyData.importingSession;
  const onImportFiles = props.onImportFiles ?? historyActions.handleImportFiles;
  const loadingSessions = props.loadingSessions ?? historyData.loadingSessions;
  const availableTags = props.availableTags ?? historyData.availableTags;
  const selectedTagId = props.selectedTagId !== undefined ? props.selectedTagId : historyData.selectedTagId;
  const onSelectTag = props.onSelectTag ?? historyActions.setSelectedTagId;
  const sessionCountByTag = props.sessionCountByTag ?? historyData.sessionCountByTag;
  const totalSessionsCount = props.totalSessionsCount ?? historyData.sessions.length;

  const onRefresh =
    props.onRefresh ??
    (() => {
      historyActions.fetchSessions();
      historyActions.fetchTags();
    });

  const isFiltered = Boolean(
    searchQuery.trim() !== '' ||
    sessionTypeFilter !== 'ALL' ||
    circuitFilter !== 'ALL' ||
    selectedTagId !== null
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSessionTypeFilter('ALL');
    setCircuitFilter('ALL');
    onSelectTag(null);
  };

  return (
    <div className="glass-panel f1-paddock-toolbar">
      <div className="f1-toolbar-controls">
        {/* Search Bar */}
        <div className="f1-search-wrapper">
          <Search size={15} className="f1-search-icon" />
          <input
            type="text"
            placeholder={t('history.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="f1-search-input mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="f1-search-clear-btn"
              title={t('common.clear') || 'Clear'}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Session Type Filter */}
        <div className="f1-filter-select-wrapper">
          <Trophy size={14} className="f1-select-icon" />
          <select
            className="f1-filter-select"
            value={sessionTypeFilter}
            onChange={(e) => setSessionTypeFilter(e.target.value)}
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
          <div className="f1-filter-select-wrapper">
            <MapPin size={14} className="f1-select-icon" />
            <select
              className="f1-filter-select"
              value={circuitFilter}
              onChange={(e) => setCircuitFilter(e.target.value)}
            >
              <option value="ALL">{t('history.allCircuits', { count: uniqueCircuits.length })}</option>
              {uniqueCircuits.map((circ) => (
                <option key={circ} value={circ}>
                  {circ}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reset Filters Quick Button */}
        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="f1-reset-filters-btn"
            title={t('history.clearFilters')}
          >
            <RotateCcw size={13} />
            <span>{t('history.clearFilters')}</span>
          </button>
        )}
      </div>

      {/* Import & Refresh Actions */}
      <div className="f1-toolbar-actions">
        {/* Import Session Button */}
        <label
          className="f1-toolbar-import-btn"
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
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('history.importing')}</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              <span>{t('history.importSession')}</span>
            </>
          )}
        </label>

        <button
          type="button"
          className="f1-toolbar-refresh-btn"
          onClick={onRefresh}
          disabled={loadingSessions}
        >
          <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
          <span>{t('common.refresh')}</span>
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
