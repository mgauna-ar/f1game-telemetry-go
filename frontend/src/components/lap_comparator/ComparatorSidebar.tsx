import React from 'react';
import { MapPin, Search, Sparkles } from 'lucide-react';
import { TrackFlag } from '../TrackFlag';
import { ComparatorTrackMap } from '../ComparatorTrackMap';
import { Button } from '../ui/Button';
import { Panel, PanelHeader } from '../ui/Panel';
import { getTurnContextAtDistance } from '../../utils/trackTurns';
import { ERS_MODE_NAMES } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';
import type { MergedTelemetryPoint, TrackTurn } from '../../types/comparator';
import type { Session } from '../../types/session';
import styles from './ComparatorSidebar.module.css';
import { useUnits } from '../../hooks/useUnits';

interface ComparatorSidebarProps {
  comparisonData: MergedTelemetryPoint[];
  detectedTurns: TrackTurn[];
  hoverDistance: number | null;
  setHoverDistance: (dist: number | null) => void;
  sector1Distance: number | null;
  sector2Distance: number | null;
  /** The zoomed stretch of the charts, which the map frames too. */
  zoomDomain: [number, number] | null;
  selectedSessionAObj?: Session | null;
  nameA: string;
  nameB: string;
  onOpenAiDebrief: () => void;
}

const percent = (value: number | null) => (value !== null ? Math.round(value * 100) : 0);

export const ComparatorSidebar: React.FC<ComparatorSidebarProps> = ({
  comparisonData,
  detectedTurns,
  hoverDistance,
  setHoverDistance,
  sector1Distance,
  sector2Distance,
  zoomDomain,
  selectedSessionAObj,
  nameA,
  nameB,
  onOpenAiDebrief,
}) => {
  const { t } = useI18n();
  const units = useUnits();
  const activePoint =
    hoverDistance !== null && comparisonData.length > 0
      ? comparisonData.reduce(
          (prev, curr) =>
            Math.abs(curr.lap_distance - hoverDistance) < Math.abs(prev.lap_distance - hoverDistance) ? curr : prev,
          comparisonData[0]
        )
      : null;

  const turnContext = getTurnContextAtDistance(detectedTurns, hoverDistance);

  const driverReadout = (slot: 'a' | 'b', point: MergedTelemetryPoint) => {
    const isA = slot === 'a';
    const speed = isA ? point.speedA : point.speedB;
    const throttle = isA ? point.throttleA : point.throttleB;
    const brake = isA ? point.brakeA : point.brakeB;
    const battery = isA ? point.ersBatteryA : point.ersBatteryB;
    const mode = isA ? point.ersDeployModeA : point.ersDeployModeB;
    const rows = [
      { label: t('comparator.sidebar.speed'), value: units.speed(speed, 0, '—') },
      { label: t('comparator.sidebar.throttleBrake'), value: `${percent(throttle)}% / ${percent(brake)}%` },
      {
        label: t('comparator.sidebar.ers'),
        value: `${battery !== null ? battery.toFixed(0) : '—'}% (${ERS_MODE_NAMES[mode ?? 0] || 'Off'})`,
      },
    ];
    return (
      <div className={styles.driver} data-slot={slot}>
        <div className={styles.driverName}>{isA ? nameA : nameB}</div>
        <dl className={styles.stats}>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <div className={styles.sidebar}>
      <Panel padding="compact">
        <PanelHeader
          level={2}
          icon={<MapPin size={16} />}
          title={t('comparator.sidebar.trackHeatmap')}
          className={styles.head}
          actions={
            <>
              {selectedSessionAObj && (
                <span className={styles.track}>
                  <TrackFlag track={selectedSessionAObj.track_name} width={14} height={10} />
                  <span>{selectedSessionAObj.track_name}</span>
                </span>
              )}
              <Button
                size="sm"
                className={styles.askAi}
                onClick={onOpenAiDebrief}
                icon={<Sparkles size={14} className={styles.sparkle} aria-hidden="true" />}
                title={t('comparator.sidebar.askAiTitle')}
              >
                {t('comparator.sidebar.askAi')}
              </Button>
            </>
          }
        />

        <ComparatorTrackMap
          data={comparisonData}
          turns={detectedTurns}
          activeDistance={hoverDistance}
          height={380}
          sector1Distance={sector1Distance}
          sector2Distance={sector2Distance}
          zoomRange={zoomDomain}
          onSelectDistance={(dist) => setHoverDistance(dist)}
        />

        {detectedTurns.length > 0 && (
          <div className={styles.turns}>
            <div className={styles.turnsHead}>
              <span className={styles.turnsLabel}>{t('comparator.sidebar.turnsJump')}</span>
              <span>{t('comparator.sidebar.turnsCount', { count: detectedTurns.length })}</span>
            </div>
            <div className={styles.turnList} role="group" aria-label={t('comparator.sidebar.turnsJump')}>
              {detectedTurns.map((turn) => (
                <button
                  key={turn.name}
                  type="button"
                  className={styles.turn}
                  aria-pressed={hoverDistance !== null && Math.abs(turn.distance - hoverDistance) <= 35}
                  onClick={() => setHoverDistance(turn.distance)}
                  title={`${turn.name} (${turn.distance}m)`}
                >
                  {turn.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {comparisonData.length > 0 && (
          <div className={styles.readout} aria-live="off">
            {activePoint ? (
              <>
                <div className={styles.readoutHead}>
                  <div className={styles.distance}>
                    <span className={styles.distanceLabel}>{t('comparator.sidebar.distancePoint')}</span>
                    <span className={styles.distanceValue}>{activePoint.lap_distance}m</span>
                  </div>
                  {turnContext.label && (
                    <span className={styles.turnContext} data-phase={turnContext.phase}>
                      <MapPin size={12} aria-hidden="true" />
                      {turnContext.label}
                    </span>
                  )}
                </div>

                <div className={styles.drivers}>
                  {driverReadout('a', activePoint)}
                  {driverReadout('b', activePoint)}
                </div>

                {activePoint.time_delta !== null && (
                  <div
                    className={styles.delta}
                    data-faster={activePoint.time_delta < 0 ? 'a' : activePoint.time_delta > 0 ? 'b' : undefined}
                  >
                    Δ {activePoint.time_delta > 0 ? '+' : ''}
                    {activePoint.time_delta.toFixed(3)}s
                  </div>
                )}
              </>
            ) : (
              <div className={styles.hint}>
                <span className={styles.hintTitle}>
                  <Search size={14} aria-hidden="true" />
                  {t('comparator.sidebar.inspectTitle')}
                </span>
                {t('comparator.sidebar.inspectHint')}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};
