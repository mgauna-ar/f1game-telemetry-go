import React, { useState } from 'react';
import { Layers, Wrench } from 'lucide-react';
import { TYRE_COMPOUNDS, TYRE_COMPOUND_IDS, getTeamColor } from '../../../constants/f1';
import { alpha, cssVar } from '../../../styles/theme';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { getCompoundColor, type DriverStintData } from './stintUtils';

const COMPOUND_LEGEND = [
  { id: TYRE_COMPOUND_IDS.SOFT, name: 'Soft' },
  { id: TYRE_COMPOUND_IDS.MEDIUM, name: 'Medium' },
  { id: TYRE_COMPOUND_IDS.HARD, name: 'Hard' },
  { id: TYRE_COMPOUND_IDS.INTERMEDIATE, name: 'Inter' },
  { id: TYRE_COMPOUND_IDS.WET, name: 'Wet' },
];

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
  const [hoveredStint, setHoveredStint] = useState<{
    driverIndex: number;
    stintIndex: number;
  } | null>(null);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <Layers size={18} color="var(--accent-primary)" />
            {t('history.stints.timeline.title')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('history.stints.timeline.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {COMPOUND_LEGEND.map(({ id, name }) => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: TYRE_COMPOUNDS[id].color }} /> {name}
            </span>
          ))}
        </div>
      </div>

      {/* Gantt Timeline Container */}
      {driverStintsData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          {t('history.stints.kpi.noStintsDesc')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <div style={{ minWidth: '760px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Lap Ruler Header */}
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '180px', marginBottom: '4px' }}>
              <div style={{ position: 'relative', width: '100%', height: '18px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const lapVal = Math.max(1, Math.round(pct * effectiveMaxLaps));
                  return (
                    <span
                      key={pct}
                      className="mono"
                      style={{
                        position: 'absolute',
                        left: `${pct * 100}%`,
                        transform: pct === 1 ? 'translateX(-100%)' : pct === 0 ? 'none' : 'translateX(-50%)',
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      L{lapVal}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Driver Stint Rows */}
            {driverStintsData.map((d, dIdx) => {
              const teamColor = getTeamColor(d.driver.participant.team_id);
              const isSelected = !!selectedDrivers[d.driver.participant.car_index];

              return (
                <div
                  key={d.driver.participant.car_index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    borderLeft: `3px solid ${teamColor}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Driver Identity Cell */}
                  <button
                    type="button"
                    className="button-reset"
                    style={{
                      width: '172px',
                      minWidth: '172px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    aria-pressed={isSelected}
                    onClick={() => toggleDriver(d.driver.participant.car_index)}
                    title={t('history.stints.timeline.clickToFilter')}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: d.driver.position === 1 ? cssVar('--f1-gold') : 'var(--text-muted)',
                        width: '24px',
                      }}
                    >
                      P{d.driver.position}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '105px',
                      }}
                    >
                      {d.driver.participant.name}
                    </span>
                    <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      #{d.driver.participant.race_number}
                    </span>
                  </button>

                  {/* Stint Bars Track Area */}
                  <div
                    style={{
                      flex: 1,
                      position: 'relative',
                      height: '24px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {d.stints.map((stint, sIdx) => {
                      const startPct = Math.max(0, ((stint.startLap - 1) / effectiveMaxLaps) * 100);
                      const endPct = Math.min(100, (stint.endLap / effectiveMaxLaps) * 100);
                      const widthPct = Math.max(2, endPct - startPct);
                      const compColor = getCompoundColor(stint.compound);
                      const isHovered = hoveredStint?.driverIndex === dIdx && hoveredStint?.stintIndex === sIdx;

                      return (
                        <div
                          key={sIdx}
                          role="presentation"
                          onMouseEnter={() => setHoveredStint({ driverIndex: dIdx, stintIndex: sIdx })}
                          onMouseLeave={() => setHoveredStint(null)}
                          onClick={() => toggleDriver(d.driver.participant.car_index)}
                          style={{
                            position: 'absolute',
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                            height: '100%',
                            backgroundColor: alpha(compColor, 0.15),
                            border: `1px solid ${alpha(compColor, 0.53)}`,
                            borderRight: stint.hasPitStopAfter ? `2px dashed ${cssVar('--status-danger')}` : `1px solid ${alpha(compColor, 0.53)}`,
                            borderRadius: sIdx === 0 ? '4px 0 0 4px' : sIdx === d.stints.length - 1 ? '0 4px 4px 0' : '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 4px',
                            cursor: 'pointer',
                            zIndex: isHovered ? 10 : 1,
                            transform: isHovered ? 'scaleY(1.12)' : 'scaleY(1)',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            boxShadow: isHovered ? `0 0 10px ${alpha(compColor, 0.53)}` : 'none',
                          }}
                          title={`Stint ${stint.stintIndex}: ${stint.compound} (Laps ${stint.startLap} - ${stint.endLap}, ${stint.totalLaps}L) | Avg: ${formatLapTime(stint.avgLapTimeMS)}`}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <TyreCompoundBadge compound={stint.compound} />
                            {widthPct > 6 && (
                              <span className="mono" style={{ fontSize: '0.65rem', fontWeight: 700, color: compColor }}>
                                {stint.totalLaps}L
                              </span>
                            )}
                          </span>

                          {stint.hasPitStopAfter && (
                            <span title={`Pit stop on lap ${stint.endLap}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <Wrench size={10} color={cssVar('--status-danger')} />
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
    </div>
  );
};
