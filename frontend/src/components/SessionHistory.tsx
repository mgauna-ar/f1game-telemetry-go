import React from 'react';
import { Calendar, Flag, ArrowLeft, RefreshCw } from 'lucide-react';
import { SessionTableView } from './session_history/SessionTableView';
import { SessionDetailView } from './session_history/SessionDetailView';
import { SessionFilterToolbar } from './session_history/SessionFilterToolbar';
import { DeleteSessionModal } from './session_history/DeleteSessionModal';
import { BatchDeleteModal } from './session_history/BatchDeleteModal';
import { BatchTagModal } from './session_history/BatchTagModal';
import { TagManagerModal } from './session_history/TagManagerModal';
import { BatchDriverModal } from './session_history/player/BatchDriverModal';
import { OldDriverNameNotice } from './session_history/player/OldDriverNameNotice';
import { PlayerPickerModal } from './session_history/player/PlayerPickerModal';
import { SessionComparatorDock } from './session_history/SessionComparatorDock';
import { SessionBatchDock } from './session_history/SessionBatchDock';
import { StandaloneToastContainer } from './common/ToastContainer';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { PageHeader } from './ui/PageHeader';
import { Panel } from './ui/Panel';
import { SkeletonGroup, SkeletonRows } from './ui/Skeleton';

import { useI18n } from '../context/I18nContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToastStore } from '../store/useToastStore';
import { navigate } from '../router/router';
import { SessionHistoryProvider } from '../context/SessionHistoryContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../context/SessionHistoryContextDefinitions';

import { sessionTypeLabel } from '../utils/sessionTypeLabel';
import styles from './SessionHistory.module.css';
import type { Session, Participant, Lap, StagedLap, DriverStanding, Tag } from '../types/session';

export type { Session, Participant, Lap, StagedLap, DriverStanding, Tag };

const SessionHistoryContent: React.FC = () => {
  const { t, locale } = useI18n();
  const {
    sessions,
    filteredSessions,
    loadingSessions,
    error,
    searchQuery,
    sessionTypeFilter,
    circuitFilter,
    selectedTagId,
    quickFilters,
    selectedSession,
    sessionToDelete,
    deletingSessionId,
    sessionToManageTags,
    availableTags,
    selectedSessionIds,
    showBatchDeleteModal,
    showBatchTagModal,
    showBatchDriverModal,
  } = useSessionHistoryData();

  const {
    closeSession,
    fetchSessions,
    setSessionToDelete,
    confirmDeleteSession,
    setSessionToManageTags,
    handleAddTag,
    handleRemoveTag,
    handleDeleteGlobalTag,
    setShowBatchDeleteModal,
    setShowBatchTagModal,
    setShowBatchDriverModal,
    handleExecuteBatchDelete,
    handleExecuteBatchTag,
  } = useSessionHistoryActions();

  // "Race · 1 Oct": the breadcrumb's last step (the track is the page's h1) and, after the track,
  // the tab title
  const sessionCrumb = selectedSession
    ? `${sessionTypeLabel(selectedSession.session_type, t)} · ${new Date(selectedSession.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`
    : '';
  useDocumentTitle(selectedSession ? `${selectedSession.track_name} ${sessionCrumb}` : t('nav.tabs.history'));

  return (
    <div className={styles.page}>
      {/* Session History Title Header */}
      {!selectedSession ? (
        <PageHeader
          icon={<Calendar />}
          title={t('history.title')}
          subtitle={t('history.subtitle')}
          aside={
            <Badge tone="accent" size="md" uppercase className={styles.count}>
              {t('history.recordedSessionsCount', { count: sessions.length })}
            </Badge>
          }
        />
      ) : (
        <div className={styles.detailBar}>
          <div className={styles.detailNav}>
            <Button icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={closeSession}>
              {t('history.backToList')}
            </Button>
            <div className={styles.crumbs}>
              <span className={styles.crumbRoot}>{t('history.title')}</span>
              <span aria-hidden="true">/</span>
              <span className={styles.crumbCurrent}>{sessionCrumb}</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: SESSION LIST & FILTER TOOLBAR */}
      {!selectedSession && (
        <div className={styles.list}>
          <OldDriverNameNotice />
          <SessionFilterToolbar />

          {/* Session Content Table */}
          {loadingSessions ? (
            <Panel as="div">
              <SkeletonGroup label={t('history.loadingRepo')}>
                <SkeletonRows rows={8} />
              </SkeletonGroup>
            </Panel>
          ) : error ? (
            <Panel as="div">
              <EmptyState
                tone="danger"
                title={error}
                action={
                  <Button variant="primary" icon={<RefreshCw size={14} />} onClick={fetchSessions}>
                    {t('common.retry')}
                  </Button>
                }
              />
            </Panel>
          ) : filteredSessions.length === 0 ? (
            <Panel as="div">
              <EmptyState
                icon={<Flag size={40} />}
                title={t('history.noSessionsFound')}
                description={
                  searchQuery ||
                  sessionTypeFilter !== 'ALL' ||
                  circuitFilter !== 'ALL' ||
                  selectedTagId !== null ||
                  quickFilters.length > 0
                    ? t('history.noSessionsMatch')
                    : t('history.noSessionsEmpty')
                }
              />
            </Panel>
          ) : (
            <SessionTableView />
          )}
        </div>
      )}

      {/* VIEW 2: SELECTED SESSION DETAIL EXPLORER */}
      {selectedSession && <SessionDetailView />}

      {/* SESSION BATCH ACTION DOCK */}
      {!selectedSession && <SessionBatchDock />}

      {/* COMPARATOR STAGING DOCK */}
      <SessionComparatorDock />

      {/* CONFIRM SINGLE DELETE MODAL */}
      <DeleteSessionModal
        session={sessionToDelete}
        deletingSessionId={deletingSessionId}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={() =>
          confirmDeleteSession(
            (id) => {
              if (selectedSession && selectedSession.id === id) {
                navigate('/history', { replace: true });
              }
              useToastStore
                .getState()
                .showToast({ type: 'success', message: t('history.batch.deleteSelected', { count: 1 }) });
            },
            (err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              useToastStore
                .getState()
                .showToast({ type: 'error', message: t('history.deleteError', { message: msg }) });
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

      {/* BATCH "SET MY DRIVER" MODAL */}
      <BatchDriverModal
        isOpen={showBatchDriverModal}
        sessionIds={[...selectedSessionIds]}
        onClose={() => setShowBatchDriverModal(false)}
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

      {/* "WHO WERE YOU?" DRIVER PICKER (list rows, story tab, your race card) */}
      <PlayerPickerModal />

      <StandaloneToastContainer />
    </div>
  );
};

export const SessionHistory: React.FC = () => {
  return (
    <SessionHistoryProvider>
      <SessionHistoryContent />
    </SessionHistoryProvider>
  );
};
