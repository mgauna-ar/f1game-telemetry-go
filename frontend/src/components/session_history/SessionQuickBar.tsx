import React, { useId, useRef, useState } from 'react';
import { Bookmark, BookmarkPlus, Layers, X, Zap } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryActions, useSessionHistoryData } from '../../context/SessionHistoryContextDefinitions';
import {
  isSameFilter,
  QUICK_FILTERS,
  RECENT_DAYS,
  SESSION_GROUP_BYS,
  type SavedSessionFilter,
} from '../../utils/sessionListView';
import { Button, IconButton } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import styles from './SessionQuickBar.module.css';

/** A default name for the filters applied now, such as "Monza · Race · Your podiums". */
const suggestName = (
  current: Omit<SavedSessionFilter, 'id' | 'name'>,
  tagName: string | undefined,
  t: (key: string, params?: Record<string, string | number>) => string
) =>
  [
    current.search.trim() && `“${current.search.trim()}”`,
    current.circuit !== 'ALL' && current.circuit,
    current.type !== 'ALL' && current.type,
    tagName,
    ...current.quick.map((q) => t(`history.list.quick.${q}`, { days: RECENT_DAYS })),
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 60);

/**
 * The row under the list's filters: one-click quick filters, the saved filter sets (apply with a
 * click, save the current filters under a name, delete), and how the list is grouped.
 */
export const SessionQuickBar: React.FC = () => {
  const { t } = useI18n();
  const data = useSessionHistoryData();
  const actions = useSessionHistoryActions();
  const [naming, setNaming] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const quickLabelId = useId();
  const savedLabelId = useId();

  const current = {
    search: data.searchQuery,
    type: data.sessionTypeFilter,
    circuit: data.circuitFilter,
    tagId: data.selectedTagId,
    quick: data.quickFilters,
  };
  const isFiltered =
    current.search.trim() !== '' ||
    current.type !== 'ALL' ||
    current.circuit !== 'ALL' ||
    current.tagId !== null ||
    current.quick.length > 0;
  const alreadySaved = data.savedFilters.some((f) => isSameFilter(f, current));
  const tagName = data.availableTags.find((tag) => tag.id === current.tagId)?.name;

  const startNaming = () => {
    setNaming(suggestName(current, tagName, t));
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const stopNaming = () => {
    setNaming(null);
    requestAnimationFrame(() => saveButtonRef.current?.focus());
  };
  const save = () => {
    if (naming?.trim()) actions.saveCurrentFilter(naming);
    stopNaming();
  };

  return (
    <div className={styles.bar}>
      <div className={styles.group} role="group" aria-labelledby={quickLabelId}>
        <span id={quickLabelId} className={styles.label}>
          <Zap size={12} aria-hidden="true" />
          {t('history.list.quickLabel')}
        </span>
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={styles.chip}
            aria-pressed={data.quickFilters.includes(filter)}
            onClick={() => actions.toggleQuickFilter(filter)}
          >
            {t(`history.list.quick.${filter}`, { days: RECENT_DAYS })}
          </button>
        ))}
      </div>

      {(data.savedFilters.length > 0 || isFiltered) && (
        <div className={styles.group} role="group" aria-labelledby={savedLabelId}>
          <span id={savedLabelId} className={styles.label}>
            <Bookmark size={12} aria-hidden="true" />
            {t('history.list.savedLabel')}
          </span>
          {data.savedFilters.map((filter) => (
            <span key={filter.id} className={styles.saved}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={isSameFilter(filter, current)}
                onClick={() => actions.applySavedFilter(filter)}
              >
                {filter.name}
              </button>
              <IconButton
                size="sm"
                className={styles.remove}
                label={t('history.list.deleteSaved', { name: filter.name })}
                onClick={() => actions.deleteSavedFilter(filter.id)}
              >
                <X size={11} />
              </IconButton>
            </span>
          ))}
          {naming !== null ? (
            <form
              className={styles.nameForm}
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                ref={inputRef}
                className={styles.nameInput}
                value={naming}
                maxLength={60}
                aria-label={t('history.list.saveName')}
                onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    stopNaming();
                  }
                }}
              />
              <Button type="submit" size="sm" variant="primary" disabled={!naming.trim()}>
                {t('history.list.save')}
              </Button>
              <Button size="sm" onClick={stopNaming}>
                {t('common.cancel')}
              </Button>
            </form>
          ) : (
            isFiltered &&
            !alreadySaved && (
              <Button
                ref={saveButtonRef}
                size="sm"
                variant="ghost"
                icon={<BookmarkPlus size={13} aria-hidden="true" />}
                onClick={startNaming}
              >
                {t('history.list.saveCurrent')}
              </Button>
            )
          )}
        </div>
      )}

      <div className={styles.groupBy}>
        <Layers size={13} className={styles.groupIcon} aria-hidden="true" />
        <SegmentedControl
          size="xs"
          aria-label={t('history.list.groupBy')}
          value={data.groupBy}
          onChange={actions.setGroupBy}
          options={SESSION_GROUP_BYS.map((value) => ({ value, label: t(`history.list.group.${value}`) }))}
        />
      </div>
    </div>
  );
};
