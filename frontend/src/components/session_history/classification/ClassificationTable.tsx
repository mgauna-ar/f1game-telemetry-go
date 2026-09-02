import React from 'react';
import { Trophy } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { ClassificationRow } from './ClassificationRow';
import type { Session, Lap, DriverStanding, StagedLap } from '../../../types/session';

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
}) => {
  const { t } = useI18n();
  const leaderBestLapMS = driverStandings.length > 0 ? driverStandings[0].bestLapTimeMS : Infinity;
  const leaderTotalRaceTimeMS = driverStandings.length > 0 ? driverStandings[0].totalRaceTimeWithPenalties : undefined;
  const leaderLapsCount = driverStandings.length > 0 ? driverStandings[0].laps.length : 0;

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={20} color="var(--accent-primary)" />
          {isRaceSession ? t('history.classification.raceClassification') : t('history.classification.timingClassification')}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-purple)' }} />
            {t('history.classification.sessionFastestSector')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-tertiary)' }} />
            {t('history.classification.personalBestSector')}
          </span>
        </div>
      </div>

      {driverStandings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          {t('history.classification.noLapData')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="history-table">
            <thead>
              {isRaceSession ? (
                <tr>
                  <th style={{ width: '55px', paddingLeft: '0.65rem' }}>{t('history.classification.headers.pos')}</th>
                  <th style={{ minWidth: '140px' }}>{t('history.classification.headers.driver')}</th>
                  <th style={{ minWidth: '110px' }}>{t('history.classification.headers.timeGap')}</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.laps')}</th>
                  <th style={{ minWidth: '120px' }}>{t('history.classification.headers.tyreStints')}</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.points')}</th>
                  <th style={{ minWidth: '95px' }}>{t('history.classification.headers.fastestLap')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s1')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s2')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s3')}</th>
                  <th style={{ minWidth: '75px' }}>{t('history.classification.headers.topSpeed')}</th>
                  <th style={{ textAlign: 'right', width: '85px', paddingRight: '0.65rem' }}>{t('history.classification.headers.details')}</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '38px', paddingLeft: '0.65rem' }}>{t('history.classification.headers.pos')}</th>
                  <th style={{ minWidth: '140px' }}>{t('history.classification.headers.driver')}</th>
                  <th style={{ minWidth: '95px' }}>{t('history.classification.headers.bestLap')}</th>
                  <th style={{ minWidth: '80px' }}>{t('history.classification.headers.gap')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s1')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s2')}</th>
                  <th style={{ minWidth: '65px' }}>{t('history.classification.headers.s3')}</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>{t('history.classification.headers.laps')}</th>
                  <th style={{ minWidth: '120px' }}>{t('history.classification.headers.tyreStints')}</th>
                  <th style={{ minWidth: '75px' }}>{t('history.classification.headers.topSpeed')}</th>
                  <th style={{ textAlign: 'right', width: '85px', paddingRight: '0.65rem' }}>{t('history.classification.headers.details')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {driverStandings.map((driver) => (
                <ClassificationRow
                  key={driver.participant.car_index}
                  session={session}
                  driver={driver}
                  isLeader={driver.position === 1}
                  isRaceSession={isRaceSession}
                  leaderBestLapMS={leaderBestLapMS}
                  leaderTotalRaceTimeMS={leaderTotalRaceTimeMS}
                  leaderLapsCount={leaderLapsCount}
                  sessionBestS1={sessionBestS1}
                  sessionBestS2={sessionBestS2}
                  sessionBestS3={sessionBestS3}
                  sessionFastestLapMS={sessionFastestLapMS}
                  isExpanded={!!expandedDrivers[driver.participant.car_index]}
                  onToggleDriverExpand={onToggleDriverExpand}
                  stagedA={stagedA}
                  stagedB={stagedB}
                  onStageLap={onStageLap}
                  onSendToComparator={onSendToComparator}
                  formatLapTime={formatLapTime}
                  formatTotalDuration={formatTotalDuration}
                  renderTyreBadge={renderTyreBadge}
                  renderDriverTyreStints={renderDriverTyreStints}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
