import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SessionDetailHeader, SESSION_DETAIL_TABS_ID, type SessionDetailTab } from './SessionDetailHeader';
import { SessionClassificationTab } from './SessionClassificationTab';
import { SessionLapChartsTab } from './SessionLapChartsTab';
import { SessionStoryTab } from './story/SessionStoryTab';
import { RACE_CHART_TABS } from '../../router/routes';
import { defaultChartSelection } from '../../utils/player';
import { SessionStintStrategyTab } from './SessionStintStrategyTab';
import { SessionSectorMatrixTab } from './SessionSectorMatrixTab';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { useI18n } from '../../context/I18nContext';
import { useSessionHistoryData, useSessionHistoryActions } from '../../context/SessionHistoryContextDefinitions';
import { formatLapTime, formatTotalDuration } from '../../utils/formatters';
import { groupLapsIntoStints } from '../../utils/lapUtils';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { SkeletonGroup, SkeletonRows } from '../ui/Skeleton';
import { TabPanel } from '../ui/Tabs';
import styles from './SessionDetailView.module.css';
import type {
  Session,
  Lap,
  StagedLap,
  DriverStanding,
  PlayerSource,
  ClassificationResponse,
  ProgressionResponse,
  StintsResponse,
  FeedEvent,
} from '../../types/session';

export interface SessionDetailViewProps {
  session?: Session;
  activeDetailTab?: SessionDetailTab;
  setActiveDetailTab?: (tab: SessionDetailTab) => void;
  loadingDetail?: boolean;
  detailError?: string | null;
  classificationData?: ClassificationResponse | null;
  progressionData?: ProgressionResponse | null;
  stintsData?: StintsResponse | null;
  events?: FeedEvent[];
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
  onSendToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  onOpenAiDebrief?: () => void;
  onExportSession?: (session: Session) => void;
  onRequestDelete?: (session: Session) => void;
  onOpenTagManager?: (session: Session) => void;
  onRemoveTag?: (tagId: number) => void;
  playerCarIndex?: number | null;
  playerSource?: PlayerSource | null;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = (props) => {
  const { t } = useI18n();
  const historyData = useSessionHistoryData();
  const historyActions = useSessionHistoryActions();

  const session = props.session ?? historyData.selectedSession;
  // The drivers on the pace, position and gap charts, kept while you move between them
  const [chartSelection, setChartSelection] = useState<{
    sessionId: number;
    selected: Record<number, boolean>;
  } | null>(null);
  if (!session) return null;

  const activeDetailTab = props.activeDetailTab ?? historyData.activeDetailTab;
  const setActiveDetailTab = props.setActiveDetailTab ?? historyActions.setActiveDetailTab;
  const loadingDetail = props.loadingDetail ?? historyData.loadingDetail;
  const detailError = props.detailError ?? historyData.detailError;
  const classificationData = props.classificationData ?? historyData.classificationData;
  const progressionData = props.progressionData ?? historyData.progressionData;
  const stintsData = props.stintsData ?? historyData.stintsData;
  const events = props.events ?? historyData.events;
  const driverStandings = props.driverStandings ?? historyData.driverStandings;
  const sessionBestS1 = props.sessionBestS1 ?? historyData.sessionBestS1;
  const sessionBestS2 = props.sessionBestS2 ?? historyData.sessionBestS2;
  const sessionBestS3 = props.sessionBestS3 ?? historyData.sessionBestS3;
  const isRaceSession = props.isRaceSession ?? historyData.isRaceSession;
  const totalSessionLaps = props.totalSessionLaps ?? historyData.totalSessionLaps;
  const totalDriversCount = props.totalDriversCount ?? historyData.totalDriversCount;
  const expandedDrivers = props.expandedDrivers ?? historyData.expandedDrivers;
  const playerCarIndex = props.playerCarIndex !== undefined ? props.playerCarIndex : historyData.playerCarIndex;
  const playerSource = props.playerSource !== undefined ? props.playerSource : historyData.playerSource;
  const onToggleDriverExpand = props.onToggleDriverExpand ?? historyActions.toggleDriverExpand;
  const stagedA = props.stagedA !== undefined ? props.stagedA : historyData.stagedSlotA;
  const stagedB = props.stagedB !== undefined ? props.stagedB : historyData.stagedSlotB;
  const onStageLap = props.onStageLap ?? historyActions.handleStageLap;
  const onSendToComparator = props.onSendToComparator ?? historyActions.sendLapToComparator;
  const onExportSession = props.onExportSession ?? historyActions.handleExportSession;
  const onRequestDelete = props.onRequestDelete ?? historyActions.setSessionToDelete;
  const onOpenTagManager = props.onOpenTagManager ?? historyActions.setSessionToManageTags;
  const onRemoveTag = props.onRemoveTag ?? ((tagId: number) => historyActions.handleRemoveTag(session.id, tagId));

  const renderTyreBadge = (compoundRaw?: string, actualCompound?: string) => {
    return <TyreCompoundBadge compound={compoundRaw} actualCompound={actualCompound} size="md" />;
  };

  const renderDriverTyreStints = (driverLaps: Lap[]) => {
    if (!driverLaps || driverLaps.length === 0) {
      return <span className={styles.none}>-</span>;
    }

    const stints = groupLapsIntoStints(driverLaps);
    if (stints.length === 0) {
      return <span className={styles.none}>-</span>;
    }

    return (
      <div className={styles.stints}>
        {stints.map(({ compound, actualCompound, count }, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight size={12} className={styles.arrow} aria-hidden="true" data-stint-arrow />}
            <div className={styles.stint}>
              <TyreCompoundBadge compound={compound} actualCompound={actualCompound} />
              <span className={styles.stintLaps}>{count}L</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Only races have the lap charts; another session opened on one shows its story
  const effectiveTab = !isRaceSession && RACE_CHART_TABS.includes(activeDetailTab) ? 'story' : activeDetailTab;
  const chartDrivers =
    chartSelection?.sessionId === session.id
      ? chartSelection.selected
      : defaultChartSelection(driverStandings, playerCarIndex);

  const renderDetailTabContent = () => {
    switch (effectiveTab) {
      case 'story':
        return (
          <SessionStoryTab
            session={session}
            driverStandings={driverStandings}
            progressionData={progressionData}
            events={events}
            isRaceSession={isRaceSession}
            playerCarIndex={playerCarIndex}
            playerSource={playerSource}
            formatLapTime={formatLapTime}
          />
        );
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
            onSendToComparator={onSendToComparator}
            formatLapTime={formatLapTime}
            formatTotalDuration={formatTotalDuration}
            renderTyreBadge={renderTyreBadge}
            renderDriverTyreStints={renderDriverTyreStints}
            playerCarIndex={playerCarIndex}
          />
        );
      case 'pace':
      case 'position':
      case 'gap':
        return (
          <SessionLapChartsTab
            chart={effectiveTab}
            events={events}
            selectedDrivers={chartDrivers}
            onSelectedDriversChange={(selected) => setChartSelection({ sessionId: session.id, selected })}
            progressionData={progressionData}
            driverStandings={driverStandings}
            totalSessionLaps={totalSessionLaps}
            formatLapTime={formatLapTime}
            isRaceSession={isRaceSession}
            playerCarIndex={playerCarIndex}
          />
        );
      case 'stints':
        return (
          <SessionStintStrategyTab
            // The stint selection belongs to one session
            key={session.id}
            stintsData={stintsData}
            driverStandings={driverStandings}
            totalSessionLaps={totalSessionLaps}
            formatLapTime={formatLapTime}
            renderTyreBadge={renderTyreBadge}
            playerCarIndex={playerCarIndex}
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
    <div className={styles.view} data-testid="session-detail-view">
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
        <Panel as="div" padding="compact">
          <EmptyState compact tone="danger" title={detailError} />
        </Panel>
      )}

      {loadingDetail ? (
        <Panel as="div">
          <SkeletonGroup label={t('history.detail.retrievingData')}>
            <SkeletonRows rows={8} />
          </SkeletonGroup>
        </Panel>
      ) : (
        <TabPanel key={effectiveTab} idPrefix={SESSION_DETAIL_TABS_ID} tab={effectiveTab} className={styles.tabContent}>
          {renderDetailTabContent()}
        </TabPanel>
      )}
    </div>
  );
};
