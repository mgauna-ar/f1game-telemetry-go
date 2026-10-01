import React from 'react';
import { Award } from 'lucide-react';
import { getTeamColor } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import { styleVars } from '../../../styles/theme';
import type { DriverStanding } from '../../../types/session';
import { cx } from '../../ui/cx';
import { Stat } from '../../ui/Stat';
import styles from './PodiumShowcase.module.css';
import { useUnits } from '../../../hooks/useUnits';

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
  const units = useUnits();

  if (top3.length === 0) return null;

  return (
    <ol className={styles.grid}>
      {top3.map((driver) => {
        const isP1 = driver.position === 1;
        const isP2 = driver.position === 2;
        const rankLabel = isP1
          ? t('history.classification.podiumP1')
          : isP2
            ? t('history.classification.podiumP2')
            : t('history.classification.podiumP3');

        return (
          <li
            key={driver.participant.car_index}
            className={cx(styles.card, isP1 ? styles.p1 : isP2 ? styles.p2 : styles.p3)}
            style={styleVars({ '--team-color': getTeamColor(driver.participant.team_id) })}
          >
            <div className={styles.rank}>
              <Award size={16} aria-hidden="true" />
              <span>{rankLabel}</span>
            </div>

            <div className={styles.driver}>
              <span className={styles.teamBar} aria-hidden="true" />
              <div>
                <div className={styles.name}>
                  {driver.participant.name}
                  <span className={styles.raceNumber}>#{driver.participant.race_number}</span>
                </div>
                <div className={styles.result}>
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

            <div className={styles.stats}>
              <Stat
                className={styles.stat}
                label={t('history.classification.bestLap')}
                value={formatLapTime(driver.bestLapTimeMS)}
                valueClassName={styles.bestLap}
              />
              <Stat className={styles.stat} label={t('history.classification.laps')} value={driver.laps.length} />
              <Stat
                className={styles.stat}
                label={t('history.classification.maxSpeed')}
                value={units.speed(driver.maxSpeed || null)}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
};
