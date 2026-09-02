import React from 'react';
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

import { useI18n } from '../context/I18nContext';
import {
  SessionHistoryProvider,
  useSessionHistoryData,
  useSessionHistoryActions,
} from '../context/SessionHistoryContext';

import type {
  Session,
  Participant,
  Lap,
  StagedLap,
  DriverStanding,
  NavigationComparatorPayload,
  Tag,
} from '../types/session';

export type { Session, Participant, Lap, StagedLap, DriverStanding, NavigationComparatorPayload, Tag };

interface SessionHistoryProps {
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
}

const SessionHistoryContent: React.FC = () => {
  const { t } = useI18n();
  const {
    filteredSessions,
    loadingSessions,
    error,
    searchQuery,
    sessionTypeFilter,
    circuitFilter,
    selectedTagId,
    selectedSession,
    sessionToDelete,
    deletingSessionId,
    sessionToManageTags,
    availableTags,
    selectedSessionIds,
    showBatchDeleteModal,
    showBatchTagModal,
    toastMessage,
  } = useSessionHistoryData();

  const {
    setSelectedSession,
    setStagedSlotA,
    setStagedSlotB,
    fetchSessions,
    setSessionToDelete,
    confirmDeleteSession,
    setSessionToManageTags,
    handleAddTag,
    handleRemoveTag,
    handleDeleteGlobalTag,
    setShowBatchDeleteModal,
    setShowBatchTagModal,
    handleExecuteBatchDelete,
    handleExecuteBatchTag,
    setToastMessage,
  } = useSessionHistoryActions();

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
          <SessionFilterToolbar />

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

export const SessionHistory: React.FC<SessionHistoryProps> = ({ onNavigateToComparator }) => {
  return (
    <SessionHistoryProvider onNavigateToComparator={onNavigateToComparator}>
      <SessionHistoryContent />
    </SessionHistoryProvider>
  );
};
