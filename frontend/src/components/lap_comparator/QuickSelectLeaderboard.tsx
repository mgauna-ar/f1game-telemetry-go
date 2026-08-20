import React from 'react';
import { Zap, Search, X, ChevronDown, ChevronUp, Activity, Clock } from 'lucide-react';
import type { Participant, Lap } from '../../types/session';
import { TEAM_COLORS } from '../../constants/f1';
import { formatTime, getRankBadgeStyle } from '../../utils/formatters';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { useI18n } from '../../context/I18nContext';

export interface QuickSelectDriver extends Participant {
  bestLap: Lap | null;
  sessionSlot?: 'A' | 'B';
  sessionTrack?: string;
  sessionType?: string;
}

interface QuickSelectLeaderboardProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  quickSelectData: {
    drivers: QuickSelectDriver[];
    totalCount: number;
    leaderLapTimeMs: number | null;
  };
  driverSearchQuery: string;
  onDriverSearchChange: (q: string) => void;
  isLinkedSessions: boolean;
  sessionAId: number | '';
  sessionBId: number | '';
  quickSelectSessionTab: 'ALL' | 'A' | 'B';
  onQuickSelectSessionTabChange: (tab: 'ALL' | 'A' | 'B') => void;
  lapAId: number | '';
  lapBId: number | '';
  lapsA: Lap[];
  lapsB: Lap[];
  onSetLapA: (id: number) => void;
  onSetLapB: (id: number) => void;
  participantsA: Participant[];
}

export const QuickSelectLeaderboard: React.FC<QuickSelectLeaderboardProps> = ({
  isOpen,
  onToggleOpen,
  quickSelectData,
  driverSearchQuery,
  onDriverSearchChange,
  isLinkedSessions,
  sessionAId,
  sessionBId,
  quickSelectSessionTab,
  onQuickSelectSessionTabChange,
  lapAId,
  lapBId,
  lapsA,
  lapsB,
  onSetLapA,
  onSetLapB,
  participantsA,
}) => {
  const { t } = useI18n();

  return (
    <div
      className="glass-panel"
      style={{
        gridColumn: 'span 12',
        padding: '0.75rem 1.25rem',
        transition: 'all 0.2s ease',
      }}
      data-testid="quick-select-panel"
    >
      {/* Panel Header & Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleOpen}
        data-testid="quick-select-header-toggle"
      >
        {/* Left: Title, Driver Count Badge & Collapsed Snippet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Zap size={15} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('comparator.quickSelect.title')}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
              data-testid="quick-select-driver-count"
            >
              {quickSelectData.drivers.length}{driverSearchQuery ? ` / ${quickSelectData.totalCount}` : ''} {t('common.drivers').toLowerCase()}
            </span>
          </div>

          {/* Top 3 snippet when collapsed */}
          {!isOpen && quickSelectData.drivers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
              {quickSelectData.drivers.slice(0, 3).map((d, i) => (
                <span
                  key={`${d.session_id}-${d.car_index}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: i === 0 ? '#ffd700' : 'var(--text-secondary)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  P{i + 1}: {d.name.split(' ').pop()} {d.bestLap ? formatTime(d.bestLap.lap_time_ms) : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Controls (Tabs, Search, Collapse Button) */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Session Tabs when in Cross-Session Mode */}
          {!isLinkedSessions && sessionAId !== sessionBId && isOpen && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.35)',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              data-testid="quick-select-session-tabs"
            >
              <button
                type="button"
                onClick={() => onQuickSelectSessionTabChange('ALL')}
                style={{
                  background: quickSelectSessionTab === 'ALL' ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  color: quickSelectSessionTab === 'ALL' ? '#fff' : 'var(--text-muted)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                data-testid="quick-tab-all"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onQuickSelectSessionTabChange('A')}
                style={{
                  background: quickSelectSessionTab === 'A' ? 'rgba(255, 71, 87, 0.2)' : 'transparent',
                  border: 'none',
                  color: quickSelectSessionTab === 'A' ? '#ff4757' : 'var(--text-muted)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                data-testid="quick-tab-a"
              >
                Session A
              </button>
              <button
                type="button"
                onClick={() => onQuickSelectSessionTabChange('B')}
                style={{
                  background: quickSelectSessionTab === 'B' ? 'rgba(0, 210, 211, 0.2)' : 'transparent',
                  border: 'none',
                  color: quickSelectSessionTab === 'B' ? '#00d2d3' : 'var(--text-muted)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                data-testid="quick-tab-b"
              >
                Session B
              </button>
            </div>
          )}

          {/* Driver Search Box */}
          {isOpen && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Filter drivers..."
                value={driverSearchQuery}
                onChange={(e) => onDriverSearchChange(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  padding: '0.25rem 1.6rem 0.25rem 1.6rem',
                  fontSize: '0.75rem',
                  color: '#fff',
                  width: '130px',
                  outline: 'none',
                }}
                data-testid="driver-quick-search-input"
              />
              {driverSearchQuery && (
                <button
                  type="button"
                  onClick={() => onDriverSearchChange('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 0,
                  }}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Expand / Collapse Button */}
          <button
            type="button"
            onClick={onToggleOpen}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.75rem',
            }}
            title={isOpen ? 'Collapse Quick Select panel' : 'Expand Quick Select panel'}
            data-testid="quick-select-collapse-btn"
          >
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{isOpen ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Grid Content */}
      {isOpen && (
        <div style={{ marginTop: '0.85rem' }}>
          {quickSelectData.drivers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No drivers match your search query.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.6rem',
                maxHeight: '340px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
              data-testid="quick-select-drivers-grid"
            >
              {quickSelectData.drivers.map((p, idx) => {
                const teamColor = TEAM_COLORS[p.team_id] || '#A0A0A0';
                const rankStyle = getRankBadgeStyle(idx + 1);
                const isAssignedA = lapAId && p.bestLap && lapAId === p.bestLap.id;
                const isAssignedB = lapBId && p.bestLap && lapBId === p.bestLap.id;
                const isParticipantInA = participantsA.some((pa) => pa.car_index === p.car_index);

                return (
                  <div
                    key={`${p.session_id}-${p.car_index}`}
                    style={{
                      background: isAssignedA
                        ? 'rgba(255, 71, 87, 0.08)'
                        : isAssignedB
                        ? 'rgba(0, 210, 211, 0.08)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: isAssignedA
                        ? '1px solid rgba(255, 71, 87, 0.4)'
                        : isAssignedB
                        ? '1px solid rgba(0, 210, 211, 0.4)'
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                    }}
                    data-testid={`quick-select-card-${p.car_index}`}
                  >
                    {/* Top Row: Rank, Team Pill, Driver Name & Assignment Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: rankStyle.bg,
                            color: rankStyle.color,
                            border: rankStyle.border,
                            flexShrink: 0,
                          }}
                          data-testid={`rank-badge-${idx + 1}`}
                        >
                          P{idx + 1}
                        </span>
                        <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: teamColor, flexShrink: 0 }} />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`#${p.race_number} ${p.name}`}
                        >
                          #{p.race_number} {p.name}
                        </span>
                        {p.bestLap?.tyre_compound && (
                          <span style={{ flexShrink: 0 }}><TyreCompoundBadge compound={p.bestLap.tyre_compound} /></span>
                        )}
                        {p.bestLap && (
                          p.bestLap.has_telemetry ? (
                            <span
                              style={{
                                fontSize: '0.60rem',
                                fontWeight: 700,
                                background: 'rgba(0, 210, 211, 0.12)',
                                color: '#00d2d3',
                                border: '1px solid rgba(0, 210, 211, 0.3)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                flexShrink: 0,
                              }}
                              title={t('comparator.quickSelect.telemetryBadge')}
                            >
                              <Activity size={9} /> {t('comparator.quickSelect.telemetryBadge')}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.60rem',
                                fontWeight: 600,
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-muted)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                flexShrink: 0,
                              }}
                              title={t('comparator.charts.noTelemetryWarning')}
                            >
                              <Clock size={9} /> {t('comparator.quickSelect.timingOnlyBadge')}
                            </span>
                          )
                        )}
                      </div>

                      {/* Session slot badge if cross-session */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        {!isLinkedSessions && sessionAId !== sessionBId && p.sessionSlot && (
                          <span
                            className={`session-badge ${p.sessionSlot === 'A' ? 'badge-red' : 'badge-cyan'}`}
                            style={{ fontSize: '0.62rem', padding: '1px 5px' }}
                          >
                            Slot {p.sessionSlot}
                          </span>
                        )}
                        {isAssignedA && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(255, 71, 87, 0.25)',
                              color: '#ff4757',
                              fontWeight: 700,
                              border: '1px solid #ff4757',
                            }}
                            data-testid="driver-assigned-a-badge"
                          >
                            Slot A
                          </span>
                        )}
                        {isAssignedB && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: 'rgba(0, 210, 211, 0.25)',
                              color: '#00d2d3',
                              fontWeight: 700,
                              border: '1px solid #00d2d3',
                            }}
                            data-testid="driver-assigned-b-badge"
                          >
                            Slot B
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Lap Time & Leader Delta & Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', minWidth: 0 }}>
                        {p.bestLap ? (
                          <>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}>
                              {formatTime(p.bestLap.lap_time_ms)}
                            </span>
                            {quickSelectData.leaderLapTimeMs && p.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs ? (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  color: '#ffd700',
                                  background: 'rgba(255, 215, 0, 0.12)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                }}
                              >
                                LEADER
                              </span>
                            ) : quickSelectData.leaderLapTimeMs && p.bestLap.lap_time_ms > quickSelectData.leaderLapTimeMs ? (
                              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                +{((p.bestLap.lap_time_ms - quickSelectData.leaderLapTimeMs) / 1000).toFixed(3)}s
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No valid lap</span>
                        )}
                      </div>

                      {/* Quick Set Actions */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        {(isLinkedSessions || isParticipantInA || p.sessionSlot === 'A') && (
                          <button
                            type="button"
                            onClick={() => {
                              const targetLaps = lapsA;
                              const driverLaps = targetLaps
                                .filter((l) => (l.car_index ?? -1) === p.car_index && l.lap_time_ms > 0 && (l.is_valid || (l.sector1_ms ?? 0) > 0))
                                .sort((a, b) => {
                                  const aValid = a.is_valid ? 1 : 0;
                                  const bValid = b.is_valid ? 1 : 0;
                                  if (aValid !== bValid) return bValid - aValid;
                                  if (a.lap_time_ms !== b.lap_time_ms) return a.lap_time_ms - b.lap_time_ms;
                                  const scoreA = (a.has_telemetry ? 10 : 0) + ((a.sector1_ms ?? 0) > 0 ? 5 : 0);
                                  const scoreB = (b.has_telemetry ? 10 : 0) + ((b.sector1_ms ?? 0) > 0 ? 5 : 0);
                                  return scoreB - scoreA;
                                });
                              if (driverLaps.length > 0) onSetLapA(driverLaps[0].id);
                            }}
                            style={{
                              background: isAssignedA ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 71, 87, 0.15)',
                              border: '1px solid rgba(255, 71, 87, 0.6)',
                              color: '#ff4757',
                              borderRadius: '4px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              fontWeight: 700,
                            }}
                            title={`Set Lap A to ${p.name}'s fastest lap`}
                            data-testid={`quick-set-a-${p.car_index}`}
                          >
                            Set A
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const targetLaps = lapsB;
                            const driverLaps = targetLaps
                              .filter((l) => (l.car_index ?? -1) === p.car_index && l.lap_time_ms > 0 && (l.is_valid || (l.sector1_ms ?? 0) > 0))
                              .sort((a, b) => {
                                const aValid = a.is_valid ? 1 : 0;
                                const bValid = b.is_valid ? 1 : 0;
                                if (aValid !== bValid) return bValid - aValid;
                                if (a.lap_time_ms !== b.lap_time_ms) return a.lap_time_ms - b.lap_time_ms;
                                const scoreA = (a.has_telemetry ? 10 : 0) + ((a.sector1_ms ?? 0) > 0 ? 5 : 0);
                                const scoreB = (b.has_telemetry ? 10 : 0) + ((b.sector1_ms ?? 0) > 0 ? 5 : 0);
                                return scoreB - scoreA;
                              });
                            if (driverLaps.length > 0) onSetLapB(driverLaps[0].id);
                          }}
                          style={{
                            background: isAssignedB ? 'rgba(0, 210, 211, 0.3)' : 'rgba(0, 210, 211, 0.15)',
                            border: '1px solid rgba(0, 210, 211, 0.6)',
                            color: '#00d2d3',
                            borderRadius: '4px',
                            padding: '0.15rem 0.45rem',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                          title={`Set Lap B to ${p.name}'s fastest lap`}
                          data-testid={`quick-set-b-${p.car_index}`}
                        >
                          Set B
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Sector Timings */}
                    {p.bestLap && Boolean(p.bestLap.sector1_ms || p.bestLap.sector2_ms || p.bestLap.sector3_ms) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {p.bestLap.sector1_ms ? (
                          <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                            S1: {(p.bestLap.sector1_ms / 1000).toFixed(3)}
                          </span>
                        ) : null}
                        {p.bestLap.sector2_ms ? (
                          <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                            S2: {(p.bestLap.sector2_ms / 1000).toFixed(3)}
                          </span>
                        ) : null}
                        {p.bestLap.sector3_ms ? (
                          <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1px 4px', borderRadius: '3px' }}>
                            S3: {(p.bestLap.sector3_ms / 1000).toFixed(3)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
