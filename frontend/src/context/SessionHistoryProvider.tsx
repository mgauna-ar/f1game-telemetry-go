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

const sessionPath = (sessionId: number, tab: SessionDetailTab = 'classification') =>
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
    sortField,
    sortOrder,
    handleToggleSort,
    uniqueCircuits,
    filteredSessions,
  } = useSessionFilters({
    sessions,
    selectedTagId,
  });

  // Modal states for batch operations
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [showBatchTagModal, setShowBatchTagModal] = useState<boolean>(false);

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
  const activeDetailTab: SessionDetailTab = route.page === 'history' ? route.tab : 'classification';
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
      sortField,
      sortOrder,
      selectedSession,
      loadingDetail,
      detailError,
      classificationData,
      progressionData,
      stintsData,
      driverStandings,
      sessionBestS1,
      sessionBestS2,
      sessionBestS3,
      isRaceSession,
      totalSessionLaps,
      totalDriversCount,
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
      sortField,
      sortOrder,
      selectedSession,
      loadingDetail,
      detailError,
      classificationData,
      progressionData,
      stintsData,
      driverStandings,
      sessionBestS1,
      sessionBestS2,
      sessionBestS3,
      isRaceSession,
      totalSessionLaps,
      totalDriversCount,
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
    ]
  );

  const actionsValue = useMemo<SessionHistoryActions>(
    () => ({
      setSearchQuery,
      setSessionTypeFilter,
      setCircuitFilter,
      setSelectedTagId,
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
      fetchSessions,
      fetchTags,
      sendLapToComparator,
      onOpenAiDebrief,
    ]
  );

  return (
    <SessionHistoryDataContext.Provider value={dataValue}>
      <SessionHistoryActionsContext.Provider value={actionsValue}>
        {children}
      </SessionHistoryActionsContext.Provider>
    </SessionHistoryDataContext.Provider>
  );
};
