import { useState, useMemo, useCallback } from 'react';
import type { Session } from '../types/session';
import { useI18n } from '../context/I18nContext';
import { matchSessionSearch } from '../utils/sessionFilterUtils';

export interface UseSessionFiltersOptions {
  sessions: Session[];
  selectedTagId?: number | null;
}

export interface UseSessionFiltersReturn {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  sessionTypeFilter: string;
  setSessionTypeFilter: React.Dispatch<React.SetStateAction<string>>;
  circuitFilter: string;
  setCircuitFilter: React.Dispatch<React.SetStateAction<string>>;
  sortField: string;
  setSortField: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: 'asc' | 'desc';
  setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  handleToggleSort: (field: string) => void;
  uniqueCircuits: string[];
  filteredSessions: Session[];
}

export function useSessionFilters({
  sessions,
  selectedTagId = null,
}: UseSessionFiltersOptions): UseSessionFiltersReturn {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('ALL');
  const [circuitFilter, setCircuitFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleToggleSort = useCallback((field: string) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortOrder((currentOrder) => (currentOrder === 'asc' ? 'desc' : 'asc'));
        return currentField;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  // Distinct track circuits list for filter dropdown
  const uniqueCircuits = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.track_name) set.add(s.track_name);
    });
    return Array.from(set).sort();
  }, [sessions]);

  // Session filtering and sorting logic
  const filteredSessions = useMemo(() => {
    const list = sessions.filter((s) => {
      const matchesSearch = matchSessionSearch(s, searchQuery, t);

      const matchesType =
        sessionTypeFilter === 'ALL' ||
        s.session_type?.toLowerCase().includes(sessionTypeFilter.toLowerCase());

      const matchesCircuit =
        circuitFilter === 'ALL' ||
        s.track_name?.toLowerCase() === circuitFilter.toLowerCase();

      const matchesTag =
        selectedTagId === null ||
        (s.tags && s.tags.some((t) => t.id === selectedTagId));

      return matchesSearch && matchesType && matchesCircuit && matchesTag;
    });

    list.sort((a, b) => {
      let comp = 0;
      if (sortField === 'id') {
        comp = a.id - b.id;
      } else if (sortField === 'track') {
        comp = (a.track_name || '').localeCompare(b.track_name || '');
      } else if (sortField === 'type') {
        comp = (a.session_type || '').localeCompare(b.session_type || '');
      } else if (sortField === 'laps') {
        comp = (a.total_laps || 0) - (b.total_laps || 0);
      } else {
        // date
        comp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return list;
  }, [sessions, searchQuery, sessionTypeFilter, circuitFilter, selectedTagId, sortField, sortOrder, t]);

  return {
    searchQuery,
    setSearchQuery,
    sessionTypeFilter,
    setSessionTypeFilter,
    circuitFilter,
    setCircuitFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    handleToggleSort,
    uniqueCircuits,
    filteredSessions,
  };
}
