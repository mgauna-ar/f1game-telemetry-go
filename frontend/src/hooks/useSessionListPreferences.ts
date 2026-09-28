import { useCallback, useState } from 'react';
import { storage } from '../utils/storage';
import {
  isSessionGroupBy,
  normalizeSavedFilters,
  type SavedSessionFilter,
  type SessionGroupBy,
} from '../utils/sessionListView';

const GROUP_BY_KEY = 'f1_history_group_by';
const SAVED_FILTERS_KEY = 'f1_history_saved_filters';

/** At most this many saved filters; the oldest goes when another is saved. */
export const MAX_SAVED_FILTERS = 12;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The session list's per-device preferences: how it is grouped and the saved filter sets. They
 * live in this browser only, and the list works the same without them.
 */
export function useSessionListPreferences() {
  const [groupBy, setGroupByState] = useState<SessionGroupBy>(() => {
    const stored = storage.get<string>(GROUP_BY_KEY, 'none');
    return isSessionGroupBy(stored) ? stored : 'none';
  });
  const [savedFilters, setSavedFilters] = useState<SavedSessionFilter[]>(() =>
    normalizeSavedFilters(storage.get<unknown>(SAVED_FILTERS_KEY, []))
  );

  const setGroupBy = useCallback((next: SessionGroupBy) => {
    setGroupByState(next);
    storage.set(GROUP_BY_KEY, next);
  }, []);

  const updateSaved = useCallback((update: (current: SavedSessionFilter[]) => SavedSessionFilter[]) => {
    setSavedFilters((current) => {
      const next = update(current);
      storage.set(SAVED_FILTERS_KEY, next);
      return next;
    });
  }, []);

  const saveFilter = useCallback(
    (filter: Omit<SavedSessionFilter, 'id'>) => {
      const name = filter.name.trim();
      if (!name) return;
      updateSaved((current) =>
        // Saving under an existing name replaces that filter
        [...current.filter((f) => f.name !== name), { ...filter, name, id: newId() }].slice(-MAX_SAVED_FILTERS)
      );
    },
    [updateSaved]
  );

  const deleteSavedFilter = useCallback(
    (id: string) => updateSaved((current) => current.filter((f) => f.id !== id)),
    [updateSaved]
  );

  return { groupBy, setGroupBy, savedFilters, saveFilter, deleteSavedFilter };
}
