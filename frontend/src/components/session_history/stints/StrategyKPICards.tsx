import React from 'react';
import { Layers, Clock, Wrench, Zap } from 'lucide-react';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { styleVars } from '../../../styles/theme';
import { Panel } from '../../ui/Panel';
import { getCompoundColor } from './stintUtils';
import type { DriverStanding, DriverStint } from '../../../types/session';
import styles from './StrategyKPICards.module.css';

export interface StrategyKPIs {
  mostPopularStrategy: string;
  mostPopularCount: number;
  longestStintDriver: { driver: DriverStanding; stint: DriverStint } | null;
  bestLapsByCompound: Record<string, { timeMS: number; driverName: string }>;
  totalFieldPitStops: number;
}

interface StrategyKPICardsProps {
  strategyKPIs: StrategyKPIs;
  driverStandings: DriverStanding[];
  formatLapTime: (ms: number) => string;
}

const KpiCard: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  label,
  icon,
  children,
}) => (
  <li className={styles.item}>
    <Panel as="div" padding="compact" className={styles.card}>
      <div className={styles.head}>
        <h4 className={styles.label}>{label}</h4>
        {icon}
      </div>
      {children}
    </Panel>
  </li>
);

export const StrategyKPICards: React.FC<StrategyKPICardsProps> = ({ strategyKPIs, driverStandings, formatLapTime }) => {
  const { t } = useI18n();
  const longest = strategyKPIs.longestStintDriver;
  const bestLaps = Object.entries(strategyKPIs.bestLapsByCompound);

  return (
    <ul className={styles.grid}>
      <KpiCard
        label={t('history.stints.kpi.mostPopularStrategy')}
        icon={<Layers size={16} className={styles.icon} aria-hidden="true" />}
      >
        <div className={styles.value}>{strategyKPIs.mostPopularStrategy}</div>
        <div className={styles.sub}>
          {strategyKPIs.mostPopularCount > 0
            ? t('history.detail.driversCount', { count: strategyKPIs.mostPopularCount })
            : t('history.stints.kpi.noStints')}
        </div>
      </KpiCard>

      <KpiCard
        label={t('history.stints.kpi.longestStint')}
        icon={<Clock size={16} className={styles.icon} aria-hidden="true" />}
      >
        {longest ? (
          <>
            <div className={styles.valueRow}>
              <TyreCompoundBadge compound={longest.stint.compound} />
              <span className={styles.value}>{t('history.detail.lapsCount', { count: longest.stint.totalLaps })}</span>
            </div>
            <div className={styles.sub}>
              {longest.driver.participant.name} (#{longest.driver.participant.race_number})
            </div>
          </>
        ) : (
          <div className={styles.none}>{t('history.stints.kpi.noStints')}</div>
        )}
      </KpiCard>

      <KpiCard
        label={t('history.stints.kpi.totalPitStops')}
        icon={<Wrench size={16} className={styles.icon} aria-hidden="true" />}
      >
        <div className={styles.value}>
          {t('history.stints.kpi.stopsCount', { count: strategyKPIs.totalFieldPitStops })}
        </div>
        <div className={styles.sub}>
          {t('history.stints.kpi.avgStopsPerCar', {
            count: (strategyKPIs.totalFieldPitStops / Math.max(driverStandings.length, 1)).toFixed(1),
          })}
        </div>
      </KpiCard>

      <KpiCard
        label={t('history.stints.kpi.bestCompoundLaps')}
        icon={<Zap size={16} className={styles.icon} aria-hidden="true" />}
      >
        <div className={styles.bestLaps}>
          {bestLaps.length === 0 ? (
            <span className={styles.none}>{t('history.stints.kpi.noStints')}</span>
          ) : (
            bestLaps.map(([comp, item]) => (
              <div
                key={comp}
                className={styles.bestLap}
                style={styleVars({ '--compound-color': getCompoundColor(comp) })}
                title={`${comp}: ${formatLapTime(item.timeMS)} (${item.driverName})`}
              >
                <TyreCompoundBadge compound={comp} />
                <span className={styles.bestLapTime}>{formatLapTime(item.timeMS)}</span>
              </div>
            ))
          )}
        </div>
      </KpiCard>
    </ul>
  );
};
