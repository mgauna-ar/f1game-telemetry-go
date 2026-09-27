import React, { useMemo } from 'react';
import type { Session, Lap, DriverStanding, PlayerSource, StagedLap } from '../../types/session';
import { PodiumShowcase } from './classification/PodiumShowcase';
import { ClassificationTable } from './classification/ClassificationTable';
import { YourRaceCard } from './classification/YourRaceCard';
import styles from './SessionClassificationTab.module.css';

export type { DriverStanding };

interface SessionClassificationTabProps {
  session: Session;
  driverStandings: DriverStanding[];
  isRaceSession: boolean;
  sessionBestS1: number;
  sessionBestS2: number;
  sessionBestS3: number;
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
  /** Your car, highlighted in the table and summed up in the "Your race" card. */
  playerCarIndex?: number | null;
  playerSource?: PlayerSource | null;
}

export const SessionClassificationTab: React.FC<SessionClassificationTabProps> = ({
  session,
  driverStandings,
  isRaceSession,
  sessionBestS1,
  sessionBestS2,
  sessionBestS3,
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
  playerSource = null,
}) => {
  const top3 = driverStandings.slice(0, 3);

  const sessionFastestLapMS = useMemo(() => {
    let fastest = Infinity;
    driverStandings.forEach((d) => {
      if (d.bestLapTimeMS > 0 && d.bestLapTimeMS < fastest) {
        fastest = d.bestLapTimeMS;
      }
    });
    return fastest < Infinity ? fastest : 0;
  }, [driverStandings]);

  return (
    <div className={styles.tab}>
      {playerCarIndex !== null && (
        <YourRaceCard
          sessionId={session.id}
          driverStandings={driverStandings}
          playerCarIndex={playerCarIndex}
          playerSource={playerSource}
          isRaceSession={isRaceSession}
          formatLapTime={formatLapTime}
        />
      )}

      {/* PODIUM SHOWCASE BANNER (Top 3) */}
      <PodiumShowcase
        top3={top3}
        isRaceSession={isRaceSession}
        formatLapTime={formatLapTime}
        formatTotalDuration={formatTotalDuration}
      />

      {/* CLASSIFICATION & STANDINGS TABLE */}
      <ClassificationTable
        session={session}
        driverStandings={driverStandings}
        isRaceSession={isRaceSession}
        sessionBestS1={sessionBestS1}
        sessionBestS2={sessionBestS2}
        sessionBestS3={sessionBestS3}
        sessionFastestLapMS={sessionFastestLapMS}
        expandedDrivers={expandedDrivers}
        onToggleDriverExpand={onToggleDriverExpand}
        stagedA={stagedA}
        stagedB={stagedB}
        onStageLap={onStageLap}
        onSendToComparator={onSendToComparator}
        formatLapTime={formatLapTime}
        formatTotalDuration={formatTotalDuration}
        renderTyreBadge={renderTyreBadge}
        renderDriverTyreStints={renderDriverTyreStints}
        playerCarIndex={playerCarIndex}
      />
    </div>
  );
};
