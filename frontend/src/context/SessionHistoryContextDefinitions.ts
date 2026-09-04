import { createContext, useContext } from 'react';
import type {
  Session,
  Lap,
  StagedLap,
  DriverStanding,
  ClassificationResponse,
  ProgressionResponse,
  StintsResponse,
  NavigationComparatorPayload,
  Tag,
} from '../types/session';
import type { ToastMessage } from '../hooks/useBatchOperations';

export interface SessionHistoryData {
  sessions: Session[];
  filteredSessions: Session[];
  uniqueCircuits: string[];
  loadingSessions: boolean;
  error: string | null;
  selectedTagId: number | null;
  availableTags: Tag[];
  sessionCountByTag: Record<number, number>;
  searchQuery: string;
  sessionTypeFilter: string;
  circuitFilter: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  selectedSession: Session | null;
  loadingDetail: boolean;
  detailError: string | null;
  classificationData: ClassificationResponse | null;
  progressionData: ProgressionResponse | null;
  stintsData: StintsResponse | null;
  driverStandings: DriverStanding[];
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  isRaceSession: boolean;
  totalSessionLaps: number;
  totalDriversCount: number;
  expandedDrivers: Record<number, boolean>;
  activeDetailTab: 'classification' | 'charts' | 'stints' | 'sectors';
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
  toastMessage: ToastMessage | null;
}

export interface SessionHistoryActions {
  setSearchQuery: (q: string) => void;
  setSessionTypeFilter: (type: string) => void;
  setCircuitFilter: (circuit: string) => void;
  setSelectedTagId: (id: number | null) => void;
  handleToggleSort: (field: string) => void;
  setSelectedSession: (session: Session | null) => void;
  selectSession: (session: Session) => void;
  setActiveDetailTab: (tab: 'classification' | 'charts' | 'stints' | 'sectors') => void;
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
  setToastMessage: React.Dispatch<React.SetStateAction<ToastMessage | null>>;
  onNavigateToComparator?: (
    payload: NavigationComparatorPayload | number,
    lapId?: number,
    slot?: 'A' | 'B'
  ) => void;
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
