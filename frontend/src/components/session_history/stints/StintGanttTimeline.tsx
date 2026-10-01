import React from 'react';
import { Layers, Wrench } from 'lucide-react';
import { TYRE_COMPOUNDS, TYRE_COMPOUND_IDS, getTeamColor } from '../../../constants/f1';
import { styleVars } from '../../../styles/theme';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { Panel, PanelHeader } from '../../ui/Panel';
import { getCompoundColor, type DriverStintData } from './stintUtils';
import styles from './StintGanttTimeline.module.css';

const COMPOUND_LEGEND = [
  { id: TYRE_COMPOUND_IDS.SOFT, key: 'soft' },
  { id: TYRE_COMPOUND_IDS.MEDIUM, key: 'medium' },
  { id: TYRE_COMPOUND_IDS.HARD, key: 'hard' },
  { id: TYRE_COMPOUND_IDS.INTERMEDIATE, key: 'inter' },
  { id: TYRE_COMPOUND_IDS.WET, key: 'wet' },
];

const RULER_MARKS = [0, 0.25, 0.5, 0.75, 1];

interface StintGanttTimelineProps {
  driverStintsData: DriverStintData[];
  selectedDrivers: Record<number, boolean>;
  toggleDriver: (carIndex: number) => void;
  effectiveMaxLaps: number;
  formatLapTime: (ms: number) => string;
}

export const StintGanttTimeline: React.FC<StintGanttTimelineProps> = ({
  driverStintsData,
  selectedDrivers,
  toggleDriver,
  effectiveMaxLaps,
  formatLapTime,
}) => {
  const { t } = useI18n();

  return (
    <Panel>
      <PanelHeader
        icon={<Layers size={16} />}
        title={t('history.stints.timeline.title')}
        subtitle={t('history.stints.timeline.subtitle')}
        actions={
          <ul className={styles.legend} aria-label={t('history.stints.timeline.legendLabel')}>
            {COMPOUND_LEGEND.map(({ id, key }) => (
              <li
                key={id}
                className={styles.legendItem}
                style={styleVars({ '--compound-color': TYRE_COMPOUNDS[id].color })}
              >
                <span className={styles.legendDot} aria-hidden="true" />
                {t(`history.stints.timeline.compounds.${key}`)}
              </li>
            ))}
          </ul>
        }
      />

      {driverStintsData.length === 0 ? (
        <EmptyState title={t('history.stints.kpi.noStintsDesc')} />
      ) : (
        <div className={styles.scroll}>
          <div className={styles.rows}>
            {/* Lap ruler */}
            <div className={styles.ruler} aria-hidden="true">
              <div className={styles.rulerTrack}>
                {RULER_MARKS.map((pct) => (
                  <span key={pct} className={styles.rulerMark} style={{ left: `${pct * 100}%` }}>
                    L{Math.max(1, Math.round(pct * effectiveMaxLaps))}
                  </span>
                ))}
              </div>
            </div>

            {/* One row of stint bars per driver */}
            {driverStintsData.map((d) => {
              const isSelected = !!selectedDrivers[d.driver.participant.car_index];
              return (
                <div
                  key={d.driver.participant.car_index}
                  className={styles.row}
                  data-selected={isSelected || undefined}
                  style={styleVars({ '--team-color': getTeamColor(d.driver.participant.team_id) })}
                >
                  <button
                    type="button"
                    className={cx('button-reset', styles.driver)}
                    aria-pressed={isSelected}
                    onClick={() => toggleDriver(d.driver.participant.car_index)}
                    title={t('history.stints.timeline.clickToFilter')}
                  >
                    <span className={cx(styles.pos, d.driver.position === 1 && styles.leader)}>
                      P{d.driver.position}
                    </span>
                    <span className={styles.name}>{d.driver.participant.name}</span>
                    <span className={styles.raceNumber}>#{d.driver.participant.race_number}</span>
                  </button>

                  <div className={styles.track}>
                    {d.stints.map((stint, sIdx) => {
                      const startPct = Math.max(0, ((stint.startLap - 1) / effectiveMaxLaps) * 100);
                      const endPct = Math.min(100, (stint.endLap / effectiveMaxLaps) * 100);
                      const widthPct = Math.max(2, endPct - startPct);

                      return (
                        // A mouse shortcut for the driver button at the start of the row
                        <div
                          key={sIdx}
                          role="presentation"
                          onClick={() => toggleDriver(d.driver.participant.car_index)}
                          className={styles.stint}
                          data-pit={stint.hasPitStopAfter || undefined}
                          style={{
                            ...styleVars({ '--compound-color': getCompoundColor(stint.compound) }),
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                          }}
                          title={[
                            t('history.stints.timeline.stintTooltipTitle', {
                              stintNum: stint.stintIndex,
                              driver: d.driver.participant.name,
                            }),
                            stint.compound,
                            t('history.stints.timeline.lapsRange', {
                              start: stint.startLap,
                              end: stint.endLap,
                              count: stint.totalLaps,
                            }),
                            `${t('history.stints.timeline.avgLapTime')}: ${formatLapTime(stint.avgLapTimeMS)}`,
                          ].join(' • ')}
                        >
                          <span className={styles.stintLabel}>
                            <TyreCompoundBadge compound={stint.compound} />
                            {widthPct > 6 && <span className={styles.stintLaps}>{stint.totalLaps}L</span>}
                          </span>

                          {stint.hasPitStopAfter && (
                            <span
                              className={styles.pit}
                              title={t('history.stints.timeline.pitLap', { lap: stint.endLap })}
                            >
                              <Wrench size={10} aria-hidden="true" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
};
