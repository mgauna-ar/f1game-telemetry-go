import React, { useState } from 'react';
import {
  Calendar,
  Flag,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionDetailView } from './session_history/SessionDetailView';
import { SessionFilterToolbar } from './session_history/SessionFilterToolbar';
import { DeleteSessionModal } from './session_history/DeleteSessionModal';
import { BatchDeleteModal } from './session_history/BatchDeleteModal';
import { BatchTagModal } from './session_history/BatchTagModal';
import { TagManagerModal } from './session_history/TagManagerModal';
import { SessionComparatorDock } from './session_history/SessionComparatorDock';
import { SessionBatchDock } from './session_history/SessionBatchDock';

import { useRaceEngineerActions } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import { formatLapTime, formatDate, getSessionBadgeClass } from '../utils/formatters';

import {
  type Session,
  type Participant,
  type Lap,
  type StagedLap,
  type DriverStanding,
  type NavigationComparatorPayload,
  type Tag,
} from '../types/session';

import { useSessionList } from '../hooks/useSessionList';
import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionTags } from '../hooks/useSessionTags';
import { useBatchOperations } from '../hooks/useBatchOperations';
import { useLapStaging } from '../hooks/useLapStaging';
import { useSessionDetail } from '../hooks/useSessionDetail';

export type { Session, Participant, Lap, StagedLap, DriverStanding, NavigationComparatorPayload, Tag };

interface SessionHistoryProps {
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onNavigateToComparator }) => {
  const { t } = useI18n();

  // AI Race Engineer Context Hook
  const { openChat } = useRaceEngineerActions();

  // Hook 1: Session list state & deletion
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

  // Hook 2: Lap Staging for Comparator Dock
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

  // Hook 3: Session Detail state & actions
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

  // Hook 5: Filters, Search & Sorting
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

  // Hook 6: Batch Operations & Import/Export
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem' }}>
      {/* Session History Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Calendar color="var(--accent-primary)" size={28} />
            {t('history.title')}
          </h1>
          <p className="mono" style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {t('history.subtitle')}
          </p>
        </div>

        {selectedSession && (
          <button
            className="nav-tab active"
            onClick={() => {
              setSelectedSession(null);
              setStagedSlotA(null);
              setStagedSlotB(null);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <ArrowLeft size={16} /> {t('history.backToList')}
          </button>
        )}
      </div>

      {/* VIEW 1: SESSION LIST & FILTER TOOLBAR */}
      {!selectedSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Controls / Filter Bar */}
          <SessionFilterToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sessionTypeFilter={sessionTypeFilter}
            setSessionTypeFilter={setSessionTypeFilter}
            circuitFilter={circuitFilter}
            setCircuitFilter={setCircuitFilter}
            uniqueCircuits={uniqueCircuits}
            importingSession={importingSession}
            onImportFiles={handleImportFiles}
            onRefresh={() => {
              fetchSessions();
              fetchTags();
            }}
            loadingSessions={loadingSessions}
            availableTags={availableTags}
            selectedTagId={selectedTagId}
            onSelectTag={setSelectedTagId}
            sessionCountByTag={sessionCountByTag}
            totalSessionsCount={sessions.length}
          />

          {/* Session Content Table */}
          {loadingSessions ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-secondary)' }}>
                {t('history.loadingRepo')}
              </p>
            </div>
          ) : error ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', borderColor: 'var(--accent-primary)' }}>
              <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{error}</p>
              <button className="nav-tab active" onClick={fetchSessions} style={{ marginTop: '1rem' }}>
                {t('common.retry')}
              </button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <Flag size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <h3>{t('history.noSessionsFound')}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {searchQuery || sessionTypeFilter !== 'ALL' || circuitFilter !== 'ALL' || selectedTagId !== null
                  ? t('history.noSessionsMatch')
                  : t('history.noSessionsEmpty')}
              </p>
            </div>
          ) : (
            <SessionTableView
              sessions={filteredSessions}
              selectedSessionIds={selectedSessionIds}
              onToggleSelectSession={handleToggleSelectSession}
              onToggleSelectAll={handleToggleSelectAll}
              onSelectSession={selectSession}
              onRequestDelete={(s) => setSessionToDelete(s)}
              onExportSession={handleExportSession}
              formatDate={formatDate}
              getSessionBadgeClass={getSessionBadgeClass}
              sortField={sortField}
              sortOrder={sortOrder}
              onToggleSort={handleToggleSort}
              onOpenTagManager={(s) => setSessionToManageTags(s)}
            />
          )}
        </div>
      )}

      {/* VIEW 2: SELECTED SESSION DETAIL EXPLORER */}
      {selectedSession && (
        <SessionDetailView
          session={selectedSession}
          activeDetailTab={activeDetailTab}
          setActiveDetailTab={setActiveDetailTab}
          loadingDetail={loadingDetail}
          detailError={detailError}
          classificationData={classificationData}
          progressionData={progressionData}
          stintsData={stintsData}
          driverStandings={driverStandings}
          sessionBestS1={sessionBestS1}
          sessionBestS2={sessionBestS2}
          sessionBestS3={sessionBestS3}
          isRaceSession={isRaceSession}
          totalSessionLaps={totalSessionLaps}
          totalDriversCount={totalDriversCount}
          expandedDrivers={expandedDrivers}
          onToggleDriverExpand={toggleDriverExpand}
          stagedA={stagedSlotA}
          stagedB={stagedSlotB}
          onStageLap={handleStageLap}
          onNavigateToComparator={onNavigateToComparator}
          onOpenAiDebrief={() => openChat()}
          onExportSession={handleExportSession}
          onRequestDelete={(s) => setSessionToDelete(s)}
          onOpenTagManager={(s) => setSessionToManageTags(s)}
          onRemoveTag={(tagId) => handleRemoveTag(selectedSession.id, tagId)}
        />
      )}

      {/* SESSION BATCH ACTION DOCK */}
      {!selectedSession && (
        <SessionBatchDock
          selectedCount={selectedSessionIds.size}
          isExporting={isExportingBatch}
          onExportZip={handleBatchExport}
          onOpenBatchTagModal={() => setShowBatchTagModal(true)}
          onRequestBatchDelete={() => setShowBatchDeleteModal(true)}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* COMPARATOR STAGING DOCK */}
      <SessionComparatorDock
        stagedA={stagedSlotA}
        stagedB={stagedSlotB}
        onClearA={handleClearStagedA}
        onClearB={handleClearStagedB}
        onClearAll={handleClearAllStaged}
        onSwap={handleSwapStagedSlots}
        onLaunch={handleLaunchComparison}
        formatLapTime={formatLapTime}
      />

      {/* CONFIRM SINGLE DELETE MODAL */}
      <DeleteSessionModal
        session={sessionToDelete}
        deletingSessionId={deletingSessionId}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={() =>
          confirmDeleteSession(
            (id) => {
              if (selectedSession && selectedSession.id === id) {
                setSelectedSession(null);
              }
              setToastMessage({ type: 'success', text: t('history.batch.deleteSelected', { count: 1 }) });
            },
            (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              setToastMessage({ type: 'error', text: `${t('history.deleteError') || 'Delete error'}: ${msg}` });
            }
          )
        }
      />

      {/* CONFIRM BATCH DELETE MODAL */}
      <BatchDeleteModal
        isOpen={showBatchDeleteModal}
        selectedCount={selectedSessionIds.size}
        onClose={() => setShowBatchDeleteModal(false)}
        onConfirm={handleExecuteBatchDelete}
      />

      {/* BATCH TAG ASSIGNMENT MODAL */}
      <BatchTagModal
        isOpen={showBatchTagModal}
        selectedCount={selectedSessionIds.size}
        availableTags={availableTags}
        onClose={() => setShowBatchTagModal(false)}
        onApplyTag={handleExecuteBatchTag}
      />

      {/* TAG MANAGER MODAL */}
      <TagManagerModal
        session={sessionToManageTags}
        availableTags={availableTags}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        onDeleteGlobalTag={handleDeleteGlobalTag}
        isOpen={sessionToManageTags !== null}
        onClose={() => setSessionToManageTags(null)}
      />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '2rem',
            zIndex: 1000,
            background:
              toastMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.95)'
                : toastMessage.type === 'info'
                ? 'rgba(0, 242, 254, 0.95)'
                : 'rgba(239, 68, 68, 0.95)',
            color: toastMessage.type === 'info' ? '#000' : '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
