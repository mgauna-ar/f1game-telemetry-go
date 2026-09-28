import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Session } from '../types/session';
import { navigate, openComparator, useRoute } from '../router/router';
import { buildPath, type SessionDetailTab } from '../router/routes';
import { useSessionListStore } from '../store/useSessionListStore';
import { useSessionList } from '../hooks/useSessionList';
import { useLapStaging } from '../hooks/useLapStaging';
import { useSessionDetail } from '../hooks/useSessionDetail';
import { useSessionTags } from '../hooks/useSessionTags';
import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionListPreferences } from '../hooks/useSessionListPreferences';
import type { SavedSessionFilter } from '../utils/sessionListView';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { useRaceEngineerActions } from './RaceEngineerContext';
import {
  SessionHistoryDataContext,
  SessionHistoryActionsContext,
  type SessionHistoryData,
  type SessionHistoryActions,
} from './SessionHistoryContextDefinitions';

export interface SessionHistoryProviderProps {
  children: React.ReactNode;
}

const sessionPath = (sessionId: number, tab: SessionDetailTab = 'story') =>
  buildPath({ page: 'history', sessionId, tab });

export const SessionHistoryProvider: React.FC<SessionHistoryProviderProps> = ({ children }) => {
  const { openChat } = useRaceEngineerActions();

  // Hook 1: Session list & deletion
  const {
    sessions,
    setSessions,
    loadingSessions,
    error,
    sessionToDelete,
    setSessionToDelete,
    deletingSessionId,
    fetchSessions,
    confirmDeleteSession,
  } = useSessionList();

  // Hook 2: Lap staging for comparator
  const {
    stagedSlotA,
    setStagedSlotA,
    stagedSlotB,
    setStagedSlotB,
    handleStageLap,
    handleSwapStagedSlots,
    handleClearStagedA,
    handleClearStagedB,
    handleClearAllStaged,
    handleLaunchComparison,
  } = useLapStaging();

  // Hook 3: Session detail
  const {
    selectedSession,
    setSelectedSession,
    loadingDetail,
    detailError,
    classificationData,
    progressionData,
    stintsData,
    events,
    expandedDrivers,
    toggleDriverExpand,
    loadSession,
    driverStandings,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    isRaceSession,
    totalSessionLaps,
    totalDriversCount,
    playerCarIndex,
    playerSource,
  } = useSessionDetail({ onClearStagedSlots: handleClearAllStaged });

  // Hook 4: Tags management
  const {
    availableTags,
    selectedTagId,
    setSelectedTagId,
    sessionToManageTags,
    setSessionToManageTags,
    fetchTags,
    handleAddTag,
    handleRemoveTag,
    handleDeleteGlobalTag,
    sessionCountByTag,
  } = useSessionTags({
    sessions,
    setSessions,
    selectedSession,
    setSelectedSession,
  });

  // Hook 5: Filters & Search
  const {
    searchQuery,
    setSearchQuery,
    sessionTypeFilter,
    setSessionTypeFilter,
    circuitFilter,
    setCircuitFilter,
    quickFilters,
    setQuickFilters,
    toggleQuickFilter,
    sortField,
    sortOrder,
    handleToggleSort,
    uniqueCircuits,
    filteredSessions,
  } = useSessionFilters({
    sessions,
    selectedTagId,
  });

  const { groupBy, setGroupBy, savedFilters, saveFilter, deleteSavedFilter } = useSessionListPreferences();

  const saveCurrentFilter = useCallback(
    (name: string) =>
      saveFilter({
        name,
        search: searchQuery,
        type: sessionTypeFilter,
        circuit: circuitFilter,
        tagId: selectedTagId,
        quick: quickFilters,
      }),
    [saveFilter, searchQuery, sessionTypeFilter, circuitFilter, selectedTagId, quickFilters]
  );

  const applySavedFilter = useCallback(
    (filter: SavedSessionFilter) => {
      setSearchQuery(filter.search);
      setSessionTypeFilter(filter.type);
      setCircuitFilter(filter.circuit);
      // A deleted tag can't filter anything
      setSelectedTagId(availableTags.some((tag) => tag.id === filter.tagId) ? filter.tagId : null);
      setQuickFilters(filter.quick);
    },
    [setSearchQuery, setSessionTypeFilter, setCircuitFilter, setSelectedTagId, setQuickFilters, availableTags]
  );

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSessionTypeFilter('ALL');
    setCircuitFilter('ALL');
    setSelectedTagId(null);
    setQuickFilters([]);
  }, [setSearchQuery, setSessionTypeFilter, setCircuitFilter, setSelectedTagId, setQuickFilters]);

  // Modal states for batch operations
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState<boolean>(false);
  const [showBatchDriverModal, setShowBatchDriverModal] = useState<boolean>(false);

  // Hook 6: Batch operations
  const {
    selectedSessionIds,
    isExportingBatch,
    importingSession,
    handleToggleSelectSession,
    handleToggleSelectAll,
    handleClearSelection,
    handleExportSession,
    handleBatchExport,
    handleImportFiles,
    handleExecuteBatchDelete,
    handleExecuteBatchTag,
  } = useBatchOperations({
    sessions,
    filteredSessions,
    setSessions,
    fetchSessions,
    fetchTags,
  });

  // The open session and its tab are in the URL (/history/:id/:tab); show what it names.
  const route = useRoute();
  const routeSessionId = route.page === 'history' ? route.sessionId : undefined;
  const activeDetailTab: SessionDetailTab = route.page === 'history' ? route.tab : 'story';
  const listLoaded = useSessionListStore((s) => s.lastFetchedAt !== null);
  const refetchedFor = useRef<number | null>(null);
  const shownSessionId = selectedSession?.id;
  useEffect(() => {
    if (routeSessionId === undefined) {
      if (shownSessionId !== undefined) {
        setSelectedSession(null);
        setStagedSlotA(null);
        setStagedSlotB(null);
      }
      return;
    }
    if (shownSessionId === routeSessionId) return;
    const session = sessions.find((s) => s.id === routeSessionId);
    if (session) {
      loadSession(session);
    } else if (listLoaded && !loadingSessions && !error) {
      // A session recorded after the list was loaded: look once more, then go back to the list.
      if (refetchedFor.current !== routeSessionId) {
        refetchedFor.current = routeSessionId;
        useSessionListStore.getState().fetchSessions({ force: true });
      } else {
        navigate('/history', { replace: true });
      }
    }
  }, [
    routeSessionId,
    shownSessionId,
    sessions,
    listLoaded,
    loadingSessions,
    error,
    loadSession,
    setSelectedSession,
    setStagedSlotA,
    setStagedSlotB,
  ]);

  // A link to the list with filters (/history?quick=&track=, as from Progress): apply them in
  // place of the current ones, then drop them from the URL so they stay changeable.
  const listFilter = route.page === 'history' && !route.sessionId ? route.listFilter : undefined;
  const listQuick = listFilter?.quick;
  const listTrack = listFilter?.track;
  useEffect(() => {
    if (!listQuick && !listTrack) return;
    resetFilters();
    if (listQuick) setQuickFilters([listQuick]);
    if (listTrack) setCircuitFilter(listTrack);
    navigate('/history', { replace: true });
  }, [listQuick, listTrack, resetFilters, setQuickFilters, setCircuitFilter]);

  const selectSession = useCallback((session: Session) => navigate(sessionPath(session.id)), []);
  const closeSession = useCallback(() => navigate('/history'), []);
  const setActiveDetailTab = useCallback(
    (tab: SessionDetailTab) => {
      if (routeSessionId !== undefined) navigate(sessionPath(routeSessionId, tab), { replace: true });
    },
    [routeSessionId]
  );
  const sendLapToComparator = useCallback((sessionId: number, lapId: number, slot: 'A' | 'B') => {
    openComparator(slot === 'A' ? { sessionA: sessionId, lapA: lapId } : { sessionB: sessionId, lapB: lapId });
  }, []);

  const onOpenAiDebrief = useCallback(() => {
    openChat();
  }, [openChat]);

  const dataValue = useMemo<SessionHistoryData>(
    () => ({
      sessions,
      filteredSessions,
      uniqueCircuits,
      loadingSessions,
      error,
      selectedTagId,
      availableTags,
      sessionCountByTag,
      searchQuery,
      sessionTypeFilter,
      circuitFilter,
      quickFilters,
      groupBy,
      savedFilters,
      sortField,
      sortOrder,
      selectedSession,
      loadingDetail,
      detailError,
      classificationData,
      progressionData,
      stintsData,
      events,
      driverStandings,
      sessionBestS1,
      sessionBestS2,
      sessionBestS3,
      isRaceSession,
      totalSessionLaps,
      totalDriversCount,
      playerCarIndex,
      playerSource,
      expandedDrivers,
      activeDetailTab,
      stagedSlotA,
      stagedSlotB,
      selectedSessionIds,
      isExportingBatch,
      importingSession,
      sessionToDelete,
      deletingSessionId,
      sessionToManageTags,
      showBatchDeleteModal,
      showBatchTagModal,
      showBatchDriverModal,
    }),
    [
      sessions,
      filteredSessions,
      uniqueCircuits,
      loadingSessions,
      error,
      selectedTagId,
      availableTags,
      sessionCountByTag,
      searchQuery,
      sessionTypeFilter,
      circuitFilter,
      quickFilters,
      groupBy,
      savedFilters,
      sortField,
      sortOrder,
      selectedSession,
      loadingDetail,
      detailError,
      classificationData,
      progressionData,
      stintsData,
      events,
      driverStandings,
      sessionBestS1,
      sessionBestS2,
      sessionBestS3,
      isRaceSession,
      totalSessionLaps,
      totalDriversCount,
      playerCarIndex,
      playerSource,
      expandedDrivers,
      activeDetailTab,
      stagedSlotA,
      stagedSlotB,
      selectedSessionIds,
      isExportingBatch,
      importingSession,
      sessionToDelete,
      deletingSessionId,
      sessionToManageTags,
      showBatchDeleteModal,
      showBatchTagModal,
      showBatchDriverModal,
    ]
  );

  const actionsValue = useMemo<SessionHistoryActions>(
    () => ({
      setSearchQuery,
      setSessionTypeFilter,
      setCircuitFilter,
      setSelectedTagId,
      toggleQuickFilter,
      setGroupBy,
      saveCurrentFilter,
      applySavedFilter,
      deleteSavedFilter,
      resetFilters,
      handleToggleSort,
      selectSession,
      closeSession,
      setActiveDetailTab,
      toggleDriverExpand,
      setStagedSlotA,
      setStagedSlotB,
      handleStageLap,
      handleSwapStagedSlots,
      handleClearStagedA,
      handleClearStagedB,
      handleClearAllStaged,
      handleLaunchComparison,
      handleToggleSelectSession,
      handleToggleSelectAll,
      handleClearSelection,
      handleExportSession,
      handleBatchExport,
      handleImportFiles,
      handleExecuteBatchDelete,
      handleExecuteBatchTag,
      setSessionToDelete,
      confirmDeleteSession,
      setSessionToManageTags,
      handleAddTag,
      handleRemoveTag,
      handleDeleteGlobalTag,
      setShowBatchDeleteModal,
      setShowBatchTagModal,
      setShowBatchDriverModal,
      fetchSessions,
      fetchTags,
      sendLapToComparator,
      onOpenAiDebrief,
    }),
    [
      setSearchQuery,
      setSessionTypeFilter,
      setCircuitFilter,
      setSelectedTagId,
      toggleQuickFilter,
      setGroupBy,
      saveCurrentFilter,
      applySavedFilter,
      deleteSavedFilter,
      resetFilters,
      handleToggleSort,
      selectSession,
      closeSession,
      setActiveDetailTab,
      toggleDriverExpand,
      setStagedSlotA,
      setStagedSlotB,
      handleStageLap,
      handleSwapStagedSlots,
      handleClearStagedA,
      handleClearStagedB,
      handleClearAllStaged,
      handleLaunchComparison,
      handleToggleSelectSession,
      handleToggleSelectAll,
      handleClearSelection,
      handleExportSession,
      handleBatchExport,
      handleImportFiles,
      handleExecuteBatchDelete,
      handleExecuteBatchTag,
      setSessionToDelete,
      confirmDeleteSession,
      setSessionToManageTags,
      handleAddTag,
      handleRemoveTag,
      handleDeleteGlobalTag,
      setShowBatchDeleteModal,
      setShowBatchTagModal,
      setShowBatchDriverModal,
      fetchSessions,
      fetchTags,
      sendLapToComparator,
      onOpenAiDebrief,
    ]
  );

  return (
    <SessionHistoryDataContext.Provider value={dataValue}>
      <SessionHistoryActionsContext.Provider value={actionsValue}>{children}</SessionHistoryActionsContext.Provider>
    </SessionHistoryDataContext.Provider>
  );
};
