import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SessionDetailHeader } from './SessionDetailHeader';
import { SessionClassificationTab } from './SessionClassificationTab';
import { SessionLapChartsTab } from './SessionLapChartsTab';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { SessionSectorMatrixTab } from './SessionSectorMatrixTab';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { formatLapTime, formatTotalDuration } from '../../utils/formatters';
import { groupLapsIntoStints } from '../../utils/lapUtils';
import type {
  Session,
  Lap,
  StagedLap,
  DriverStanding,
  ClassificationResponse,
  ProgressionResponse,
  StintsResponse,
  NavigationComparatorPayload,
} from '../../types/session';

export interface SessionDetailViewProps {
  session?: Session;
  activeDetailTab?: 'classification' | 'charts' | 'stints' | 'sectors';
  setActiveDetailTab?: (tab: 'classification' | 'charts' | 'stints' | 'sectors') => void;
  loadingDetail?: boolean;
  detailError?: string | null;
  classificationData?: ClassificationResponse | null;
  progressionData?: ProgressionResponse | null;
  stintsData?: StintsResponse | null;
  driverStandings?: DriverStanding[];
  sessionBestS1?: number;
  sessionBestS2?: number;
  sessionBestS3?: number;
  isRaceSession?: boolean;
  totalSessionLaps?: number;
  totalDriversCount?: number;
  expandedDrivers?: Record<number, boolean>;
  onToggleDriverExpand?: (carIndex: number) => void;
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onStageLap?: (session: Session, lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
  onOpenAiDebrief?: () => void;
  onExportSession?: (session: Session) => void;
  onRequestDelete?: (session: Session) => void;
  onOpenTagManager?: (session: Session) => void;
  onRemoveTag?: (tagId: number) => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const session = props.session ?? historyData.selectedSession;
  if (!session) return null;

  const activeDetailTab = props.activeDetailTab ?? historyData.activeDetailTab;
  const setActiveDetailTab = props.setActiveDetailTab ?? historyActions.setActiveDetailTab;
  const loadingDetail = props.loadingDetail ?? historyData.loadingDetail;
  const detailError = props.detailError ?? historyData.detailError;
  const classificationData = props.classificationData ?? historyData.classificationData;
  const progressionData = props.progressionData ?? historyData.progressionData;
  const stintsData = props.stintsData ?? historyData.stintsData;
  const driverStandings = props.driverStandings ?? historyData.driverStandings;
  const sessionBestS1 = props.sessionBestS1 ?? historyData.sessionBestS1;
  const sessionBestS2 = props.sessionBestS2 ?? historyData.sessionBestS2;
  const sessionBestS3 = props.sessionBestS3 ?? historyData.sessionBestS3;
  const isRaceSession = props.isRaceSession ?? historyData.isRaceSession;
  const totalSessionLaps = props.totalSessionLaps ?? historyData.totalSessionLaps;
  const totalDriversCount = props.totalDriversCount ?? historyData.totalDriversCount;
  const expandedDrivers = props.expandedDrivers ?? historyData.expandedDrivers;
  const onToggleDriverExpand = props.onToggleDriverExpand ?? historyActions.toggleDriverExpand;
  const stagedA = props.stagedA !== undefined ? props.stagedA : historyData.stagedSlotA;
  const stagedB = props.stagedB !== undefined ? props.stagedB : historyData.stagedSlotB;
  const onStageLap = props.onStageLap ?? historyActions.handleStageLap;
  const onNavigateToComparator = props.onNavigateToComparator ?? historyActions.onNavigateToComparator;
  const onExportSession = props.onExportSession ?? historyActions.handleExportSession;
  const onRequestDelete = props.onRequestDelete ?? historyActions.setSessionToDelete;
  const onOpenTagManager = props.onOpenTagManager ?? historyActions.setSessionToManageTags;
  const onRemoveTag = props.onRemoveTag ?? ((tagId: number) => historyActions.handleRemoveTag(session.id, tagId));

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
    return <TyreCompoundBadge compound={compoundRaw} actualCompound={actualCompound} className="tyre-badge" />;
  };

  const renderDriverTyreStints = (driverLaps: Lap[]) => {
    if (!driverLaps || driverLaps.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const stints = groupLapsIntoStints(driverLaps);
    if (stints.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
        {stints.map(({ compound, actualCompound, count }, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 1px' }}>➔</span>}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <TyreCompoundBadge compound={compound} actualCompound={actualCompound} className="tyre-badge" />
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {count}L
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const effectiveTab = !isRaceSession && activeDetailTab === 'charts' ? 'classification' : activeDetailTab;

  const renderDetailTabContent = () => {
    switch (effectiveTab) {
      case 'classification':
        return (
          <SessionClassificationTab
            session={session}
            driverStandings={driverStandings}
            isRaceSession={isRaceSession}
            sessionBestS1={sessionBestS1}
            sessionBestS2={sessionBestS2}
            sessionBestS3={sessionBestS3}
            expandedDrivers={expandedDrivers}
            onToggleDriverExpand={onToggleDriverExpand}
            stagedA={stagedA}
            stagedB={stagedB}
            onStageLap={(lap, driver, slot) => onStageLap(session, lap, driver, slot)}
            onSendToComparator={onNavigateToComparator}
            formatLapTime={formatLapTime}
            formatTotalDuration={formatTotalDuration}
            renderTyreBadge={renderTyreBadge}
            renderDriverTyreStints={renderDriverTyreStints}
          />
        );
      case 'charts':
        return (
          <SessionLapChartsTab
            progressionData={progressionData}
            driverStandings={driverStandings}
            totalSessionLaps={totalSessionLaps}
            formatLapTime={formatLapTime}
            isRaceSession={isRaceSession}
          />
        );
      case 'stints':
        return (
          <SessionStintStrategyTab
            stintsData={stintsData}
            driverStandings={driverStandings}
            totalSessionLaps={totalSessionLaps}
            formatLapTime={formatLapTime}
            renderTyreBadge={renderTyreBadge}
          />
        );
      case 'sectors':
      default:
        return (
          <SessionSectorMatrixTab
            classificationData={classificationData}
            driverStandings={driverStandings}
            sessionBestS1={sessionBestS1}
            sessionBestS2={sessionBestS2}
            sessionBestS3={sessionBestS3}
            formatLapTime={formatLapTime}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} data-testid="session-detail-view">
      <SessionDetailHeader
        session={session}
        isRaceSession={isRaceSession}
        activeDetailTab={effectiveTab}
        setActiveDetailTab={setActiveDetailTab}
        totalSessionLaps={totalSessionLaps}
        totalDriversCount={totalDriversCount}
        onExportSession={() => onExportSession(session)}
        onRequestDelete={() => onRequestDelete(session)}
        onOpenTagManager={() => onOpenTagManager(session)}
        onRemoveTag={(tagId) => onRemoveTag(tagId)}
      />

      {/* Detail Tab Contents */}
      {detailError && (
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-primary)', background: 'rgba(255, 71, 87, 0.1)' }}>
          <p style={{ margin: 0, color: '#ff4757', fontWeight: 600 }}>{detailError}</p>
        </div>
      )}

      {loadingDetail ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('history.detail.retrievingData')}
          </p>
        </div>
      ) : (
        renderDetailTabContent()
      )}
    </div>
  );
};
