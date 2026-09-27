import React from 'react';
import { Search, RefreshCw, Upload, X, Trophy, MapPin, RotateCcw } from 'lucide-react';
import { TagFilterBar } from './TagFilterBar';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import type { Tag } from '../../types/session';
import { Button, IconButton } from '../ui/Button';
import { cx } from '../ui/cx';
import styles from './SessionFilterToolbar.module.css';

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
    searchQuery.trim() !== '' || sessionTypeFilter !== 'ALL' || circuitFilter !== 'ALL' || selectedTagId !== null
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSessionTypeFilter('ALL');
    setCircuitFilter('ALL');
    onSelectTag(null);
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.controls}>
        {/* Search */}
        <div className={styles.search}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            aria-label={t('history.searchLabel')}
            placeholder={t('history.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          {searchQuery && (
            <IconButton
              size="sm"
              className={styles.searchClear}
              label={t('common.clear')}
              onClick={() => setSearchQuery('')}
            >
              <X size={13} />
            </IconButton>
          )}
        </div>

        {/* Session type filter */}
        <div className={styles.selectWrap}>
          <Trophy size={14} className={styles.selectIcon} aria-hidden="true" />
          <select
            className={styles.select}
            aria-label={t('history.typeFilterLabel')}
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

        {/* Circuit filter */}
        {uniqueCircuits.length > 0 && (
          <div className={styles.selectWrap}>
            <MapPin size={14} className={styles.selectIcon} aria-hidden="true" />
            <select
              className={styles.select}
              aria-label={t('history.circuitFilterLabel')}
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

        {isFiltered && (
          <Button
            size="sm"
            className={styles.reset}
            icon={<RotateCcw size={13} aria-hidden="true" />}
            onClick={handleResetFilters}
          >
            {t('history.clearFilters')}
          </Button>
        )}
      </div>

      {/* Import & refresh */}
      <div className={styles.actions}>
        {/* The file input stays focusable (visually hidden), so the label works from the keyboard */}
        <label className={cx(styles.import, importingSession && styles.busy)} title={t('history.importDropPrompt')}>
          <input
            type="file"
            multiple
            accept=".f1session,.zip"
            className="sr-only"
            disabled={importingSession}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onImportFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          {importingSession ? (
            <RefreshCw size={14} className={styles.spin} aria-hidden="true" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          <span>{importingSession ? t('history.importing') : t('history.importSession')}</span>
        </label>

        <Button onClick={onRefresh} loading={loadingSessions} icon={<RefreshCw size={14} aria-hidden="true" />}>
          {t('common.refresh')}
        </Button>
      </div>

      {availableTags.length > 0 && (
        <div className={styles.tags}>
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
