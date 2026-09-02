import React from 'react';
import { Award } from 'lucide-react';
import { TEAM_COLORS } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import type { DriverStanding } from '../../../types/session';

interface PodiumShowcaseProps {
  top3: DriverStanding[];
  isRaceSession: boolean;
  formatLapTime: (ms: number) => string;
  formatTotalDuration: (ms: number) => string;
}

export const PodiumShowcase: React.FC<PodiumShowcaseProps> = ({
  top3,
  isRaceSession,
  formatLapTime,
  formatTotalDuration,
}) => {
  const { t } = useI18n();

  if (top3.length === 0) return null;

  return (
    <div className="podium-grid">
      {top3.map((driver) => {
        const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';
        const isP1 = driver.position === 1;
        const isP2 = driver.position === 2;
        const rankClass = isP1 ? 'podium-p1' : isP2 ? 'podium-p2' : 'podium-p3';
        const rankLabel = isP1
          ? t('history.classification.podiumP1')
          : isP2
          ? t('history.classification.podiumP2')
          : t('history.classification.podiumP3');
        const rankColor = isP1 ? '#ffd700' : isP2 ? '#c0c0c0' : '#cd7f32';

        return (
          <div key={driver.participant.car_index} className={`glass-panel podium-card ${rankClass}`}>
            <div className="podium-rank-ribbon" style={{ color: rankColor }}>
              <Award size={16} />
              <span>{rankLabel}</span>
            </div>

            <div className="podium-driver-info">
              <div style={{ width: '4px', height: '32px', backgroundColor: teamColor, borderRadius: '2px' }} />
              <div>
                <div className="podium-driver-name">
                  {driver.participant.name}
                  <span className="mono podium-race-num">#{driver.participant.race_number}</span>
                </div>
                <div className="podium-driver-sub mono">
                  {isRaceSession
                    ? driver.isDSQ
                      ? 'DSQ'
                      : driver.isDNF
                      ? 'DNF'
                      : formatTotalDuration(driver.totalRaceTimeMS ?? 0)
                    : t('history.classification.bestPrefix', { time: formatLapTime(driver.bestLapTimeMS) })}
                </div>
              </div>
            </div>

            <div className="podium-stats-row mono">
              <div className="podium-stat">
                <span className="stat-label">{t('history.classification.bestLap')}</span>
                <span className="stat-value" style={{ color: 'var(--accent-tertiary)' }}>
                  {formatLapTime(driver.bestLapTimeMS)}
                </span>
              </div>
              <div className="podium-stat">
                <span className="stat-label">{t('history.classification.laps')}</span>
                <span className="stat-value">{driver.laps.length}</span>
              </div>
              <div className="podium-stat">
                <span className="stat-label">{t('history.classification.maxSpeed')}</span>
                <span className="stat-value">
                  {driver.maxSpeed ? `${driver.maxSpeed.toFixed(0)} km/h` : '--'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
