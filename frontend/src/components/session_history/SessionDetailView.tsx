import React from 'react';
import { RefreshCw } from 'lucide-react';
import { SessionDetailHeader } from './SessionDetailHeader';
import { SessionClassificationTab } from './SessionClassificationTab';
import { SessionLapChartsTab } from './SessionLapChartsTab';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { SessionSectorMatrixTab } from './SessionSectorMatrixTab';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { useI18n } from '../../context/I18nContext';
import { formatLapTime, formatTotalDuration, formatDate, getSessionBadgeClass } from '../../utils/formatters';
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

interface SessionDetailViewProps {
  session: Session;
  activeDetailTab: 'classification' | 'charts' | 'stints' | 'sectors';
  setActiveDetailTab: (tab: 'classification' | 'charts' | 'stints' | 'sectors') => void;
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
  onToggleDriverExpand: (carIndex: number) => void;
  stagedA: StagedLap | null;
  stagedB: StagedLap | null;
  onStageLap: (session: Session, lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
  onOpenAiDebrief: () => void;
  onExportSession: (session: Session) => void;
  onRequestDelete: (session: Session) => void;
  onOpenTagManager: (session: Session) => void;
  onRemoveTag: (tagId: number) => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  activeDetailTab,
  setActiveDetailTab,
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
  onToggleDriverExpand,
  stagedA,
  stagedB,
  onStageLap,
  onNavigateToComparator,
  onOpenAiDebrief,
  onExportSession,
  onRequestDelete,
  onOpenTagManager,
  onRemoveTag,
}) => {
  const { t } = useI18n();

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
    return <TyreCompoundBadge compound={compoundRaw} actualCompound={actualCompound} className="tyre-badge" />;
  };

  const renderDriverTyreStints = (driverLaps: Lap[]) => {
    if (!driverLaps || driverLaps.length === 0) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>;
    }

    const sortedLaps = [...driverLaps].sort((a, b) => a.lap_number - b.lap_number);
    const stints: { compound: string; actualCompound?: string; count: number; stintId: number }[] = [];
    let currentStint: { compound: string; actualCompound?: string; count: number; stintId: number } | null = null;

    sortedLaps.forEach((lap) => {
      const raw = lap.tyre_compound?.trim();
      if (!raw) return;

      const lapStint = lap.stint && lap.stint > 0 ? lap.stint : 0;

      const isNewStint =
        !currentStint ||
        (lapStint > 0 && currentStint.stintId > 0 && lapStint !== currentStint.stintId) ||
        currentStint.compound.toUpperCase() !== raw.toUpperCase();

      if (isNewStint || !currentStint) {
        currentStint = { compound: raw, actualCompound: lap.actual_compound, count: 1, stintId: lapStint };
        stints.push(currentStint);
      } else {
        currentStint.count += 1;
        if (!currentStint.actualCompound && lap.actual_compound) {
          currentStint.actualCompound = lap.actual_compound;
        }
      }
    });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <SessionDetailHeader
        session={session}
        activeDetailTab={activeDetailTab}
        setActiveDetailTab={setActiveDetailTab}
        totalSessionLaps={totalSessionLaps}
        totalDriversCount={totalDriversCount}
        onOpenAiDebrief={onOpenAiDebrief}
        onExportSession={() => onExportSession(session)}
        onRequestDelete={() => onRequestDelete(session)}
        onOpenTagManager={() => onOpenTagManager(session)}
        onRemoveTag={(tagId) => onRemoveTag(tagId)}
        formatDate={formatDate}
        getSessionBadgeClass={getSessionBadgeClass}
      />

      {/* Detail Tab Contents */}
      {detailError && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '1.5rem', borderColor: 'var(--accent-primary)' }}>
          <p style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{detailError}</p>
        </div>
      )}

      {loadingDetail ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            {t('history.detail.retrievingData')}
          </p>
        </div>
      ) : activeDetailTab === 'classification' ? (
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
      ) : activeDetailTab === 'charts' ? (
        <SessionLapChartsTab
          progressionData={progressionData}
          driverStandings={driverStandings}
          totalSessionLaps={totalSessionLaps}
          formatLapTime={formatLapTime}
          isRaceSession={isRaceSession}
        />
      ) : activeDetailTab === 'stints' ? (
        <SessionStintStrategyTab
          stintsData={stintsData}
          driverStandings={driverStandings}
          totalSessionLaps={totalSessionLaps}
          formatLapTime={formatLapTime}
          renderTyreBadge={renderTyreBadge}
        />
      ) : (
        <SessionSectorMatrixTab
          classificationData={classificationData}
          driverStandings={driverStandings}
          sessionBestS1={sessionBestS1}
          sessionBestS2={sessionBestS2}
          sessionBestS3={sessionBestS3}
          formatLapTime={formatLapTime}
        />
      )}
    </div>
  );
};
