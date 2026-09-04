import React, { useState, useMemo, useCallback } from 'react';
import type { NavigationComparatorPayload } from '../types/session';
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
  onNavigateToComparator?: (
    payload: NavigationComparatorPayload | number,
    lapId?: number,
    slot?: 'A' | 'B'
  ) => void;
}

export const SessionHistoryProvider: React.FC<SessionHistoryProviderProps> = ({
  children,
  onNavigateToComparator,
}) => {
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
  } = useLapStaging({
    onNavigateToComparator,
  });

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
    activeDetailTab,
    setActiveDetailTab,
    selectSession,
    driverStandings,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    isRaceSession,
    totalSessionLaps,
    totalDriversCount,
  } = useSessionDetail({
    onClearStagedSlots: () => {
      setStagedSlotA(null);
      setStagedSlotB(null);
    },
  });

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
    toastMessage,
    setToastMessage,
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
      toastMessage,
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
      toastMessage,
    ]
  );

  const actionsValue = useMemo<SessionHistoryActions>(
    () => ({
      setSearchQuery,
      setSessionTypeFilter,
      setCircuitFilter,
      setSelectedTagId,
      handleToggleSort,
      setSelectedSession,
      selectSession,
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
      setToastMessage,
      onNavigateToComparator,
      onOpenAiDebrief,
    }),
    [
      setSearchQuery,
      setSessionTypeFilter,
      setCircuitFilter,
      setSelectedTagId,
      handleToggleSort,
      setSelectedSession,
      selectSession,
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
      setToastMessage,
      onNavigateToComparator,
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
