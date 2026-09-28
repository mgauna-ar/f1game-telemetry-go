import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { SectorSwatch } from '../../common/SectorTime';
import { DataTable } from '../../ui/DataTable';
import { EmptyState } from '../../ui/EmptyState';
import { Panel, PanelHeader } from '../../ui/Panel';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { useClassificationColumns, type GapMode } from './classificationColumns';
import { DriverLapsSubTable } from './DriverLapsSubTable';
import type { Session, Lap, DriverStanding, StagedLap } from '../../../types/session';
import styles from './ClassificationTable.module.css';

interface ClassificationTableProps {
  session: Session;
  driverStandings: DriverStanding[];
  isRaceSession: boolean;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
  sessionFastestLapMS: number;
  expandedDrivers: Record<number, boolean>;
  onToggleDriverExpand: (carIndex: number) => void;
  stagedA?: StagedLap | null;
  stagedB?: StagedLap | null;
  onStageLap?: (lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  onSendToComparator?: (sessionId: number, lapId: number, slot: 'A' | 'B') => void;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
  renderTyreBadge: (compoundRaw?: string, actualCompound?: string) => React.ReactNode;
  renderDriverTyreStints: (laps: Lap[]) => React.ReactNode;
  /** Your car's row is highlighted and marked YOU. */
  playerCarIndex?: number | null;
}

export const ClassificationTable: React.FC<ClassificationTableProps> = ({
  session,
  driverStandings,
  isRaceSession,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
  sessionFastestLapMS,
  expandedDrivers,
  onToggleDriverExpand,
  stagedA,
  stagedB,
  onStageLap,
  onSendToComparator,
  formatLapTime,
  formatTotalDuration,
  renderTyreBadge,
  renderDriverTyreStints,
  playerCarIndex = null,
}) => {
  const { t } = useI18n();
  const leader = driverStandings[0];
  const [gapMode, setGapMode] = useState<GapMode>('gap');

  const columns = useClassificationColumns({
    isRaceSession,
    // Lobbies without a points system report 0 for everyone, which only adds noise
    showPoints: isRaceSession && driverStandings.some((d) => (d.points ?? 0) > 0),
    leaderBestLapMS: leader ? leader.bestLapTimeMS : Infinity,
    leaderTotalRaceTimeMS: leader?.totalRaceTimeWithPenalties,
    leaderLapsCount: leader ? leader.laps.length : 0,
    sessionBestS1,
    sessionBestS2,
    sessionBestS3,
    sessionFastestLapMS,
    expandedDrivers,
    onToggleDriverExpand,
    formatLapTime,
    formatTotalDuration,
    renderDriverTyreStints,
    playerCarIndex,
    gapMode,
    standings: driverStandings,
  });

  return (
    <Panel>
      <PanelHeader
        icon={<Trophy size={20} color="var(--accent-primary)" />}
        title={
          isRaceSession
            ? t('history.classification.raceClassification')
            : t('history.classification.timingClassification')
        }
        actions={
          <div className={styles.headerActions}>
            <SegmentedControl
              size="xs"
              aria-label={t('history.classification.gapModeLabel')}
              value={gapMode}
              onChange={setGapMode}
              options={[
                {
                  value: 'gap',
                  label: t(isRaceSession ? 'history.classification.gapModeGap' : 'history.classification.gapModePole'),
                },
                { value: 'interval', label: t('history.classification.gapModeInterval') },
              ]}
            />
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <SectorSwatch kind="session" />
                {t('history.classification.sessionFastestSector')}
              </span>
              <span className={styles.legendItem}>
                <SectorSwatch kind="personal" />
                {t('history.classification.personalBestSector')}
              </span>
              <span className={styles.legendItem}>
                <SectorSwatch kind="slower" />
                {t('history.classification.slowerSector')}
              </span>
            </div>
          </div>
        }
      />

      {driverStandings.length === 0 ? (
        <EmptyState compact title={t('history.classification.noLapData')} />
      ) : (
        <DataTable
          caption={t('history.classification.tableCaption')}
          columns={columns}
          rows={driverStandings}
          getRowKey={(driver) => driver.participant.car_index}
          onRowClick={(driver) => onToggleDriverExpand(driver.participant.car_index)}
          getRowClassName={(driver) => (driver.participant.car_index === playerCarIndex ? styles.you : undefined)}
          renderExpanded={(driver) =>
            expandedDrivers[driver.participant.car_index] ? (
              <DriverLapsSubTable
                session={session}
                driver={driver}
                sessionBestS1={sessionBestS1}
                sessionBestS2={sessionBestS2}
                sessionBestS3={sessionBestS3}
                stagedA={stagedA}
                stagedB={stagedB}
                onStageLap={onStageLap}
                onSendToComparator={onSendToComparator}
                formatLapTime={formatLapTime}
                formatTotalDuration={formatTotalDuration}
                renderTyreBadge={renderTyreBadge}
              />
            ) : null
          }
          stickyHeader
          density="compact"
          className={styles.scroll}
        />
      )}
    </Panel>
  );
};
