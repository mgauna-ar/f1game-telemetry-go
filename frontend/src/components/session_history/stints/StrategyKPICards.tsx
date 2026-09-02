import React from 'react';
import { Layers, Clock, Wrench, Zap } from 'lucide-react';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { getCompoundColor } from './stintUtils';
import type { DriverStanding, DriverStint } from '../../../types/session';

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

export const StrategyKPICards: React.FC<StrategyKPICardsProps> = ({
  strategyKPIs,
  driverStandings,
  formatLapTime,
}) => {
  const { t } = useI18n();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
      }}
    >
      {/* Most Popular Strategy */}
      <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {t('history.stints.kpi.mostPopularStrategy').toUpperCase()}
          </span>
          <Layers size={16} color="var(--accent-primary)" />
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>
          {strategyKPIs.mostPopularStrategy}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {strategyKPIs.mostPopularCount > 0
            ? t('history.detail.driversCount', { count: strategyKPIs.mostPopularCount })
            : t('history.stints.kpi.noStints')}
        </div>
      </div>

      {/* Longest Stint */}
      <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {t('history.stints.kpi.longestStint').toUpperCase()}
          </span>
          <Clock size={16} color="#ffd700" />
        </div>
        {strategyKPIs.longestStintDriver ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
              <TyreCompoundBadge compound={strategyKPIs.longestStintDriver.stint.compound} />
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                {t('history.detail.lapsCount', { count: strategyKPIs.longestStintDriver.stint.totalLaps })}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {strategyKPIs.longestStintDriver.driver.participant.name} (#{strategyKPIs.longestStintDriver.driver.participant.race_number})
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('history.stints.kpi.noStints')}</div>
        )}
      </div>

      {/* Total Pit Stops */}
      <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {t('history.stints.kpi.totalPitStops').toUpperCase()}
          </span>
          <Wrench size={16} color="#ff3366" />
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.25rem' }}>
          {t('history.stints.kpi.stopsCount', { count: strategyKPIs.totalFieldPitStops })}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {(strategyKPIs.totalFieldPitStops / Math.max(driverStandings.length, 1)).toFixed(1)} avg stops / car
        </div>
      </div>

      {/* Fastest Compound Laps */}
      <div className="glass-panel" style={{ padding: '1.1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            {t('history.stints.kpi.bestCompoundLaps').toUpperCase()}
          </span>
          <Zap size={16} color="#a855f7" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {Object.keys(strategyKPIs.bestLapsByCompound).length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('history.stints.kpi.noStints')}</span>
          ) : (
            Object.entries(strategyKPIs.bestLapsByCompound).map(([comp, item]) => (
              <div
                key={comp}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  fontSize: '0.72rem',
                }}
                title={`${comp}: ${formatLapTime(item.timeMS)} (${item.driverName})`}
              >
                <TyreCompoundBadge compound={comp} />
                <span className="mono" style={{ color: getCompoundColor(comp), fontWeight: 700 }}>
                  {formatLapTime(item.timeMS)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
