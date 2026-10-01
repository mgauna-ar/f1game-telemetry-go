import React from 'react';
import { Info, UserRound } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import type { DriverStanding, FeedEvent, PlayerSource, ProgressionResponse, Session } from '../../../types/session';
import { Button } from '../../ui/Button';
import { Callout } from '../../ui/Callout';
import { YourRaceCard } from '../classification/YourRaceCard';
import { openPlayerPicker } from '../player/playerPickerStore';
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
            session={session}
            driverStandings={driverStandings}
            playerCarIndex={playerCarIndex}
            playerSource={playerSource}
            isRaceSession={isRaceSession}
            formatLapTime={formatLapTime}
          />
        ) : (
          <Callout
            tone="neutral"
            role="note"
            data-testid="no-driver"
            icon={<Info size={16} />}
            actions={
              <Button
                size="sm"
                variant="primary"
                icon={<UserRound size={14} aria-hidden="true" />}
                onClick={() => openPlayerPicker(session)}
              >
                {t('history.player.pickDriver')}
              </Button>
            }
          >
            {t('history.player.noDriver')}
          </Callout>
        )}
        {isRaceSession && playerCarIndex !== null && (
          <FieldPaceChart
            lapPace={progressionData?.lap_pace}
            driverStandings={driverStandings}
            playerCarIndex={playerCarIndex}
            events={events}
          />
        )}
        <SessionDebriefPanel
          // A new driver starts a new debrief
          key={`${session.id}:${playerCarIndex}`}
          sessionId={session.id}
          playerCarIndex={playerCarIndex}
        />
      </div>
      {hasEvents ? (
        <div className={styles.side}>
          <KeyMomentsTimeline events={events} playerCarIndex={playerCarIndex} />
        </div>
      ) : (
        <Callout tone="neutral" role="note" icon={<Info size={16} />}>
          {t('history.story.noEvents')}
        </Callout>
      )}
    </div>
  );
};
