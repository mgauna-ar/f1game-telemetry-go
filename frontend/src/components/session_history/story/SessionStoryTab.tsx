import React from 'react';
import { Info } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import type { DriverStanding, FeedEvent, PlayerSource, ProgressionResponse, Session } from '../../../types/session';
import { YourRaceCard } from '../classification/YourRaceCard';
import { FieldPaceChart } from './FieldPaceChart';
import { KeyMomentsTimeline } from './KeyMomentsTimeline';
import { SessionDebriefPanel } from './SessionDebriefPanel';
import styles from './SessionStoryTab.module.css';

interface SessionStoryTabProps {
  session: Session;
  driverStandings: DriverStanding[];
  progressionData: ProgressionResponse | null;
  events: FeedEvent[];
  isRaceSession: boolean;
  playerCarIndex: number | null;
  playerSource: PlayerSource | null;
  formatLapTime: (ms: number) => string;
}

/**
 * The session's first tab: your result, your pace against the field, the key moments from the
 * race-control feed and the AI engineer's debrief. Sessions recorded before the feed was stored
 * have no timeline; a note says why.
 */
export const SessionStoryTab: React.FC<SessionStoryTabProps> = ({
  session,
  driverStandings,
  progressionData,
  events,
  isRaceSession,
  playerCarIndex,
  playerSource,
  formatLapTime,
}) => {
  const { t } = useI18n();
  const hasEvents = events.length > 0;

  return (
    <div className={styles.story} data-events={hasEvents || undefined}>
      <div className={styles.main}>
        {playerCarIndex !== null ? (
          <YourRaceCard
            sessionId={session.id}
            driverStandings={driverStandings}
            playerCarIndex={playerCarIndex}
            playerSource={playerSource}
            isRaceSession={isRaceSession}
            formatLapTime={formatLapTime}
          />
        ) : (
          <p className={styles.note}>
            <Info size={14} aria-hidden="true" />
            {t('history.player.notRecorded')}
          </p>
        )}
        {isRaceSession && playerCarIndex !== null && (
          <FieldPaceChart
            lapPace={progressionData?.lap_pace}
            driverStandings={driverStandings}
            playerCarIndex={playerCarIndex}
            events={events}
          />
        )}
        <SessionDebriefPanel sessionId={session.id} />
      </div>
      {hasEvents ? (
        <div className={styles.side}>
          <KeyMomentsTimeline events={events} playerCarIndex={playerCarIndex} />
        </div>
      ) : (
        <p className={styles.note}>
          <Info size={14} aria-hidden="true" />
          {t('history.story.noEvents')}
        </p>
      )}
    </div>
  );
};
