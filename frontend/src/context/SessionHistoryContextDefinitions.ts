import { createContext, useContext } from 'react';
import type {
  PlayerSource,
  Session,
  SessionListItem,
  Lap,
  StagedLap,
  DriverStanding,
  ClassificationResponse,
  ProgressionResponse,
  StintsResponse,
  FeedEvent,
  Tag,
} from '../types/session';
import type { SessionDetailTab } from '../router/routes';
import type { QuickFilter, SavedSessionFilter, SessionGroupBy } from '../utils/sessionListView';

export interface SessionHistoryData {
  sessions: SessionListItem[];
  filteredSessions: SessionListItem[];
  uniqueCircuits: string[];
  loadingSessions: boolean;
  error: string | null;
  selectedTagId: number | null;
  availableTags: Tag[];
  sessionCountByTag: Record<number, number>;
  searchQuery: string;
  sessionTypeFilter: string;
  circuitFilter: string;
  quickFilters: QuickFilter[];
  /** How the list is grouped; kept per device. */
  groupBy: SessionGroupBy;
  /** Named filter sets; kept per device. */
  savedFilters: SavedSessionFilter[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  selectedSession: Session | null;
  loadingDetail: boolean;
  detailError: string | null;
  classificationData: ClassificationResponse | null;
  progressionData: ProgressionResponse | null;
  stintsData: StintsResponse | null;
  /** The open session's race-control events; empty for sessions recorded before they were stored. */
  events: FeedEvent[];
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  isRaceSession: boolean;
  totalSessionLaps: number;
  totalDriversCount: number;
  /** Your car in the open session, found from its stored car or the saved driver name. */
  playerCarIndex: number | null;
  playerSource: PlayerSource | null;
  expandedDrivers: Record<number, boolean>;
  /** The open session's tab, from the URL. */
  activeDetailTab: SessionDetailTab;
  stagedSlotA: StagedLap | null;
  stagedSlotB: StagedLap | null;
  selectedSessionIds: Set<number>;
  isExportingBatch: boolean;
  importingSession: boolean;
  sessionToDelete: Session | null;
  deletingSessionId: number | null;
  sessionToManageTags: Session | null;
  showBatchDeleteModal: boolean;
  showBatchTagModal: boolean;
}

export interface SessionHistoryActions {
  setSearchQuery: (q: string) => void;
  setSessionTypeFilter: (type: string) => void;
  setCircuitFilter: (circuit: string) => void;
  setSelectedTagId: (id: number | null) => void;
  toggleQuickFilter: (filter: QuickFilter) => void;
  setGroupBy: (groupBy: SessionGroupBy) => void;
  /** Saves the filters applied now under a name. */
  saveCurrentFilter: (name: string) => void;
  applySavedFilter: (filter: SavedSessionFilter) => void;
  deleteSavedFilter: (id: string) => void;
  /** Clears the search, the type, circuit and tag filters and the quick filters. */
  resetFilters: () => void;
  handleToggleSort: (field: string) => void;
  /** Opens a session's page (`/history/:id`). */
  selectSession: (session: Session) => void;
  /** Back to the session list (`/history`). */
  closeSession: () => void;
  setActiveDetailTab: (tab: SessionDetailTab) => void;
  toggleDriverExpand: (carIndex: number) => void;
  setStagedSlotA: (lap: StagedLap | null) => void;
  setStagedSlotB: (lap: StagedLap | null) => void;
  handleStageLap: (session: Session, lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  handleSwapStagedSlots: () => void;
  handleClearStagedA: () => void;
  handleClearStagedB: () => void;
  handleClearAllStaged: () => void;
  handleLaunchComparison: () => void;
  handleToggleSelectSession: (sessionId: number) => void;
  handleToggleSelectAll: () => void;
  handleClearSelection: () => void;
  handleExportSession: (session: Session) => Promise<void>;
  handleBatchExport: () => Promise<void>;
  handleImportFiles: (files: FileList | File[]) => Promise<void>;
  handleExecuteBatchDelete: () => Promise<void>;
  handleExecuteBatchTag: (tagId: number) => Promise<void>;
  setSessionToDelete: (session: Session | null) => void;
  confirmDeleteSession: (
    onDeleted?: (deletedId: number) => void,
    onError?: (err: unknown) => void
  ) => Promise<void>;
  setSessionToManageTags: (session: Session | null) => void;
  handleAddTag: (
    sessionId: number,
    tagId?: number,
    newTag?: { name: string; color: string }
  ) => Promise<void>;
  handleRemoveTag: (sessionId: number, tagId: number) => Promise<void>;
  handleDeleteGlobalTag: (tagId: number) => Promise<void>;
  setShowBatchDeleteModal: (show: boolean) => void;
  setShowBatchTagModal: (show: boolean) => void;
  fetchSessions: () => Promise<void>;
  fetchTags: () => Promise<void>;
  /** Opens the comparator with one lap in the given slot. */
  sendLapToComparator: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  onOpenAiDebrief: () => void;
}

export const SessionHistoryDataContext = createContext<SessionHistoryData | null>(null);
export const SessionHistoryActionsContext = createContext<SessionHistoryActions | null>(null);

export function useSessionHistoryData(): SessionHistoryData {
  const context = useContext(SessionHistoryDataContext);
  if (!context) {
    throw new Error('useSessionHistoryData must be used within a SessionHistoryProvider');
  }
  return context;
}

export function useSessionHistoryActions(): SessionHistoryActions {
  const context = useContext(SessionHistoryActionsContext);
  if (!context) {
    throw new Error('useSessionHistoryActions must be used within a SessionHistoryProvider');
  }
  return context;
}
