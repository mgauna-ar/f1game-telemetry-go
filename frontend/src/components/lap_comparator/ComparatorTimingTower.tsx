import React, { useState, useMemo } from 'react';
import {
  Zap,
  Trophy,
  Users,
  Timer,
  ChevronsUp,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Clock,
  Filter,
} from 'lucide-react';
import type { Participant, Lap } from '../../types/session';
import type { QuickSelectDriver } from '../../types/comparator';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { TEAM_COLORS } from '../../constants/f1';
import { formatTime, formatSectorTime, getRankBadgeStyle } from '../../utils/formatters';
import { sortLapsByQuality } from '../../utils/lapUtils';
import { useI18n } from '../../context/I18nContext';

export interface ComparatorTimingTowerProps {
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
  slotADriver?: Participant;
  slotBDriver?: Participant;
  lapAObj?: Lap;
  lapBObj?: Lap;
}

export const ComparatorTimingTower: React.FC<ComparatorTimingTowerProps> = ({
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
  slotADriver,
  slotBDriver: _slotBDriver,
  lapAObj,
  lapBObj: _lapBObj,
}) => {
  const { t } = useI18n();

  // Local table filters & expanded lap drilldowns
  const [validOnly, setValidOnly] = useState(false);
  const [telemetryOnly, setTelemetryOnly] = useState(false);
  const [expandedDriverCarIndex, setExpandedDriverCarIndex] = useState<number | null>(null);

  // Quick Preset Handlers
  const handleVsLeader = () => {
    const leader = quickSelectData.drivers.find(
      (d) => d.bestLap && d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs
    );
    if (leader?.bestLap) {
      onSetLapB(leader.bestLap.id);
    }
  };

  const handleVsTeammate = () => {
    if (!slotADriver) return;
    const teammate = quickSelectData.drivers.find(
      (d) => d.team_id === slotADriver.team_id && d.car_index !== slotADriver.car_index && d.bestLap
    );
    if (teammate?.bestLap) {
      onSetLapB(teammate.bestLap.id);
    }
  };

  const handlePersonalBest = () => {
    if (!slotADriver) return;
    const driverLaps = sortLapsByQuality(lapsA.filter((l) => (l.car_index ?? -1) === slotADriver.car_index));
    if (driverLaps.length > 0) {
      const best = driverLaps[0];
      if (lapAId !== best.id) {
        onSetLapA(best.id);
      } else if (lapBId !== best.id) {
        onSetLapB(best.id);
      }
    }
  };

  const handleNextAhead = () => {
    if (!slotADriver) return;
    const currentIdx = quickSelectData.drivers.findIndex((d) => d.car_index === slotADriver.car_index);
    if (currentIdx > 0) {
      const ahead = quickSelectData.drivers[currentIdx - 1];
      if (ahead?.bestLap) {
        onSetLapB(ahead.bestLap.id);
      }
    }
  };

  // Filter drivers for table
  const displayedDrivers = useMemo(() => {
    return quickSelectData.drivers.filter((d) => {
      if (validOnly && (!d.bestLap || !d.bestLap.is_valid || d.bestLap.lap_time_ms <= 0)) {
        return false;
      }
      if (telemetryOnly && (!d.bestLap || !d.bestLap.has_telemetry)) {
        return false;
      }
      return true;
    });
  }, [quickSelectData.drivers, validOnly, telemetryOnly]);

  return (
    <div
      className={`glass-panel timing-tower-panel ${isOpen ? 'is-expanded' : 'is-collapsed'}`}
      style={{
        gridColumn: 'span 12',
        transition: 'all 0.25s ease',
      }}
      data-testid="quick-select-panel"
    >
      {/* Top Header Bar with Presets & Collapse Toggle */}
      <div className="timing-tower-header-bar">
        {/* Left: Title & Driver Count */}
        <div className="tower-header-left">
          <div className="tower-title-group" onClick={onToggleOpen} style={{ cursor: 'pointer' }}>
            <Zap size={15} className="tower-lightning-icon" />
            <span className="tower-title">{t('comparator.timingTower.title')}</span>
            <span className="tower-count-badge" data-testid="timing-tower-count">
              {quickSelectData.drivers.length}
              {driverSearchQuery ? ` / ${quickSelectData.totalCount}` : ''}{' '}
              {t('common.drivers').toLowerCase()}
            </span>
          </div>

          {/* Preset Buttons Bar */}
          <div className="tower-presets-bar">
            <button
              type="button"
              className="tower-preset-btn"
              onClick={handleVsLeader}
              title={t('comparator.timingTower.presetVsLeaderTooltip')}
              data-testid="preset-vs-leader"
            >
              <Trophy size={12} className="preset-icon" />
              <span>{t('comparator.timingTower.presetVsLeader')}</span>
            </button>

            {slotADriver && (
              <button
                type="button"
                className="tower-preset-btn"
                onClick={handleVsTeammate}
                title={t('comparator.timingTower.presetVsTeammateTooltip')}
                data-testid="preset-vs-teammate"
              >
                <Users size={12} className="preset-icon" />
                <span>{t('comparator.timingTower.presetVsTeammate')}</span>
              </button>
            )}

            {slotADriver && (
              <button
                type="button"
                className="tower-preset-btn"
                onClick={handlePersonalBest}
                title={t('comparator.timingTower.presetPersonalBestTooltip')}
                data-testid="preset-personal-best"
              >
                <Timer size={12} className="preset-icon" />
                <span>{t('comparator.timingTower.presetPersonalBest')}</span>
              </button>
            )}

            {slotADriver && (
              <button
                type="button"
                className="tower-preset-btn"
                onClick={handleNextAhead}
                title={t('comparator.timingTower.presetNextAheadTooltip')}
                data-testid="preset-next-ahead"
              >
                <ChevronsUp size={12} className="preset-icon" />
                <span>{t('comparator.timingTower.presetNextAhead')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Search, Filter Toggles & Expand Button */}
        <div className="tower-header-right">
          {/* Quick Collapsed Top 3 Rivals Strip */}
          {!isOpen && quickSelectData.drivers.length > 0 && (
            <div className="tower-collapsed-top3" onClick={onToggleOpen}>
              {quickSelectData.drivers.slice(0, 3).map((d, i) => (
                <button
                  key={`top3-${d.car_index}`}
                  type="button"
                  className={`top3-pill p${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (d.bestLap) onSetLapB(d.bestLap.id);
                  }}
                  title={`Click to set ${d.name} as rival`}
                >
                  <span className="p-num">P{i + 1}</span>
                  <span className="p-name">{d.name.split(' ').pop()}</span>
                  <span className="p-time">
                    {d.bestLap ? formatTime(d.bestLap.lap_time_ms) : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search Input (visible when open) */}
          {isOpen && (
            <div className="tower-search-wrapper">
              <Search size={13} className="tower-search-icon" />
              <input
                type="text"
                placeholder={t('comparator.timingTower.searchDriver')}
                value={driverSearchQuery}
                onChange={(e) => onDriverSearchChange(e.target.value)}
                className="tower-search-input"
                data-testid="driver-quick-search-input"
              />
              {driverSearchQuery && (
                <button
                  type="button"
                  className="tower-search-clear"
                  onClick={() => onDriverSearchChange('')}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          )}

          {/* Filter Toggles (visible when open) */}
          {isOpen && (
            <div className="tower-filter-toggles">
              <button
                type="button"
                className={`tower-filter-btn ${validOnly ? 'active' : ''}`}
                onClick={() => setValidOnly((prev) => !prev)}
                title="Filter to valid completed laps only"
              >
                <Filter size={11} />
                <span>{t('comparator.timingTower.filterValidOnly')}</span>
              </button>

              <button
                type="button"
                className={`tower-filter-btn ${telemetryOnly ? 'active' : ''}`}
                onClick={() => setTelemetryOnly((prev) => !prev)}
                title="Filter to laps with telemetry recorded"
              >
                <Activity size={11} />
                <span>{t('comparator.timingTower.filterTelemetryOnly')}</span>
              </button>
            </div>
          )}

          {/* Cross-session slot tabs (if cross-session active) */}
          {isOpen && !isLinkedSessions && sessionAId !== sessionBId && (
            <div className="tower-slot-tabs">
              <button
                type="button"
                className={`tower-tab-btn ${quickSelectSessionTab === 'ALL' ? 'active' : ''}`}
                onClick={() => onQuickSelectSessionTabChange('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`tower-tab-btn tab-a ${quickSelectSessionTab === 'A' ? 'active' : ''}`}
                onClick={() => onQuickSelectSessionTabChange('A')}
              >
                Slot A
              </button>
              <button
                type="button"
                className={`tower-tab-btn tab-b ${quickSelectSessionTab === 'B' ? 'active' : ''}`}
                onClick={() => onQuickSelectSessionTabChange('B')}
              >
                Slot B
              </button>
            </div>
          )}

          {/* Expand / Collapse Button */}
          <button
            type="button"
            className="tower-toggle-expand-btn"
            onClick={onToggleOpen}
            aria-label={isOpen ? 'Collapse Timing Tower' : 'Expand Timing Tower'}
            data-testid="quick-select-collapse-btn"
          >
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span style={{ fontSize: '0.72rem', fontWeight: 600, marginLeft: '4px' }}>
              {isOpen ? 'Collapse' : 'Expand'}
            </span>
          </button>
        </div>
      </div>

      {/* Expanded F1 Broadcast Timing Table */}
      {isOpen && (
        <div className="timing-tower-table-container">
          {displayedDrivers.length === 0 ? (
            <div className="timing-tower-empty">
              <span>{t('comparator.timingTower.noMatchingDrivers')}</span>
            </div>
          ) : (
            <div className="timing-tower-table-scroll" data-testid="quick-select-drivers-grid">
              <table className="timing-tower-table" data-testid="timing-tower-table">
                <thead>
                  <tr>
                    <th className="col-pos">{t('comparator.timingTower.colPos')}</th>
                    <th className="col-driver">{t('comparator.timingTower.colDriver')}</th>
                    <th className="col-tyre">{t('comparator.timingTower.colTyre')}</th>
                    <th className="col-best-lap">{t('comparator.timingTower.colBestLap')}</th>
                    <th className="col-gap-leader">{t('comparator.timingTower.colGapLeader')}</th>
                    <th className="col-gap-baseline">{t('comparator.timingTower.colGapBaseline')}</th>
                    <th className="col-sector">{t('comparator.timingTower.colS1')}</th>
                    <th className="col-sector">{t('comparator.timingTower.colS2')}</th>
                    <th className="col-sector">{t('comparator.timingTower.colS3')}</th>
                    <th className="col-telemetry">TEL</th>
                    <th className="col-actions">{t('comparator.timingTower.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDrivers.map((d, idx) => {
                    const teamColor = TEAM_COLORS[d.team_id] || '#A0A0A0';
                    const rankStyle = getRankBadgeStyle(idx + 1);
                    const isAssignedA = Boolean(lapAId && d.bestLap && lapAId === d.bestLap.id);
                    const isAssignedB = Boolean(lapBId && d.bestLap && lapBId === d.bestLap.id);
                    const isDriverInA = participantsA.some((pa) => pa.car_index === d.car_index);
                    const isExpanded = expandedDriverCarIndex === d.car_index;

                    // Gap to baseline (Slot A)
                    let baselineGapText: React.ReactNode = '-';
                    if (slotADriver && slotADriver.car_index === d.car_index) {
                      baselineGapText = (
                        <span className="baseline-tag">{t('comparator.timingTower.baselineBadge')}</span>
                      );
                    } else if (lapAObj && d.bestLap && d.bestLap.lap_time_ms > 0) {
                      const deltaMs = d.bestLap.lap_time_ms - lapAObj.lap_time_ms;
                      if (deltaMs < 0) {
                        baselineGapText = (
                          <span className="gap-faster">
                            -{(Math.abs(deltaMs) / 1000).toFixed(3)}s
                          </span>
                        );
                      } else if (deltaMs > 0) {
                        baselineGapText = (
                          <span className="gap-slower">
                            +{(deltaMs / 1000).toFixed(3)}s
                          </span>
                        );
                      } else {
                        baselineGapText = <span className="gap-equal">0.000s</span>;
                      }
                    }

                    // Gap to leader
                    let leaderGapText: React.ReactNode = '-';
                    if (d.bestLap && quickSelectData.leaderLapTimeMs) {
                      if (d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs) {
                        leaderGapText = (
                          <span className="leader-pill">{t('comparator.timingTower.leaderBadge')}</span>
                        );
                      } else {
                        const gap = d.bestLap.lap_time_ms - quickSelectData.leaderLapTimeMs;
                        leaderGapText = (
                          <span className="leader-gap-val">+{(gap / 1000).toFixed(3)}s</span>
                        );
                      }
                    }

                    return (
                      <React.Fragment key={`tower-driver-${d.session_id}-${d.car_index}`}>
                        <tr
                          className={`tower-driver-row ${isAssignedA ? 'assigned-a' : ''} ${
                            isAssignedB ? 'assigned-b' : ''
                          }`}
                          data-testid={`timing-tower-row-${d.car_index}`}
                        >
                          {/* POS */}
                          <td className="col-pos">
                            <span
                              className="rank-badge"
                              style={{
                                background: rankStyle.bg,
                                color: rankStyle.color,
                                border: rankStyle.border,
                              }}
                              data-testid={`rank-badge-${idx + 1}`}
                            >
                              P{idx + 1}
                            </span>
                          </td>

                          {/* DRIVER */}
                          <td className="col-driver">
                            <div className="driver-cell">
                              <span
                                className="team-stripe"
                                style={{ backgroundColor: teamColor }}
                              />
                              <span className="race-num">#{d.race_number}</span>
                              <span className="driver-name" title={d.name}>
                                {d.name}
                              </span>
                              {isAssignedA && (
                                <span className="slot-indicator slot-a-ind">
                                  {t('comparator.timingTower.baselineBadge')}
                                </span>
                              )}
                              {isAssignedB && (
                                <span className="slot-indicator slot-b-ind">
                                  {t('comparator.timingTower.rivalBadge')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* TYRE */}
                          <td className="col-tyre">
                            {d.bestLap?.tyre_compound ? (
                              <TyreCompoundBadge compound={d.bestLap.tyre_compound} />
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* BEST LAP */}
                          <td className="col-best-lap">
                            {d.bestLap ? (
                              <span
                                className={`best-lap-time ${
                                  d.bestLap.lap_time_ms === quickSelectData.leaderLapTimeMs
                                    ? 'fastest-lap'
                                    : ''
                                }`}
                              >
                                {formatTime(d.bestLap.lap_time_ms)}
                              </span>
                            ) : (
                              <span className="no-lap">-</span>
                            )}
                          </td>

                          {/* GAP TO LEADER */}
                          <td className="col-gap-leader">{leaderGapText}</td>

                          {/* GAP TO BASELINE */}
                          <td className="col-gap-baseline">{baselineGapText}</td>

                          {/* SECTORS */}
                          <td className="col-sector">
                            {d.bestLap?.sector1_ms ? `S1: ${formatSectorTime(d.bestLap.sector1_ms)}` : '-'}
                          </td>
                          <td className="col-sector">
                            {d.bestLap?.sector2_ms ? `S2: ${formatSectorTime(d.bestLap.sector2_ms)}` : '-'}
                          </td>
                          <td className="col-sector">
                            {d.bestLap?.sector3_ms ? `S3: ${formatSectorTime(d.bestLap.sector3_ms)}` : '-'}
                          </td>

                          {/* TELEMETRY */}
                          <td className="col-telemetry">
                            {d.bestLap ? (
                              d.bestLap.has_telemetry ? (
                                <span
                                  className="telemetry-chip full"
                                  title={t('comparator.timingTower.filterTelemetryOnly')}
                                >
                                  <Activity size={12} />
                                </span>
                              ) : (
                                <span
                                  className="telemetry-chip timing"
                                  title="Timing data only"
                                >
                                  <Clock size={12} />
                                </span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>

                          {/* ACTIONS */}
                          <td className="col-actions">
                            <div className="actions-cell">
                              {/* Primary: Set as Comparison (B) */}
                              <button
                                type="button"
                                className={`action-btn-rival ${isAssignedB ? 'is-active' : ''}`}
                                onClick={() => {
                                  const driverLaps = sortLapsByQuality(
                                    lapsB.filter((l) => (l.car_index ?? -1) === d.car_index)
                                  );
                                  if (driverLaps.length > 0) onSetLapB(driverLaps[0].id);
                                }}
                                title={`Set ${d.name}'s fastest lap as Comparison (Slot B)`}
                                data-testid={`tower-set-rival-${d.car_index}`}
                              >
                                {isAssignedB
                                  ? (t('comparator.timingTower.btnSetRivalActive') || 'Comp ✓')
                                  : t('comparator.timingTower.btnSetRival')}
                              </button>

                              {/* Secondary: Set as Base (A) */}
                              {(isLinkedSessions || isDriverInA || d.sessionSlot === 'A') && (
                                <button
                                  type="button"
                                  className={`action-btn-baseline ${isAssignedA ? 'is-active' : ''}`}
                                  onClick={() => {
                                    const driverLaps = sortLapsByQuality(
                                      lapsA.filter((l) => (l.car_index ?? -1) === d.car_index)
                                    );
                                    if (driverLaps.length > 0) onSetLapA(driverLaps[0].id);
                                  }}
                                  title={`Set ${d.name}'s fastest lap as Reference Base (Slot A)`}
                                  data-testid={`tower-set-baseline-${d.car_index}`}
                                >
                                  {isAssignedA
                                    ? (t('comparator.timingTower.btnSetBaselineActive') || 'Base ✓')
                                    : t('comparator.timingTower.btnSetBaseline')}
                                </button>
                              )}

                              {/* Toggle Lap History Drilldown */}
                              <button
                                type="button"
                                className={`action-btn-expand ${isExpanded ? 'is-open' : ''}`}
                                onClick={() =>
                                  setExpandedDriverCarIndex(isExpanded ? null : d.car_index)
                                }
                                title={isExpanded ? t('comparator.timingTower.hideLaps') : t('comparator.timingTower.showLaps')}
                                data-testid={`tower-expand-laps-${d.car_index}`}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Lap History Drilldown Sub-row */}
                        {isExpanded && (
                          <tr className="tower-drilldown-row">
                            <td colSpan={11} className="tower-drilldown-container">
                              <div className="driver-lap-history">
                                <div className="lap-history-header">
                                  <span>
                                    {t('comparator.timingTower.lapHistoryTitle', { driver: d.name })}
                                  </span>
                                </div>
                                <div className="lap-history-grid">
                                  {lapsA
                                    .filter((l) => (l.car_index ?? -1) === d.car_index)
                                    .map((lap) => {
                                      const isLapA = lapAId === lap.id;
                                      const isLapB = lapBId === lap.id;
                                      return (
                                        <div
                                          key={`history-lap-${lap.id}`}
                                          className={`lap-history-card ${isLapA ? 'is-lap-a' : ''} ${
                                            isLapB ? 'is-lap-b' : ''
                                          }`}
                                        >
                                          <div className="card-top">
                                            <span className="lap-num">Lap {lap.lap_number}</span>
                                            <span className="lap-time">
                                              {formatTime(lap.lap_time_ms)}
                                            </span>
                                            {lap.tyre_compound && (
                                              <TyreCompoundBadge compound={lap.tyre_compound} />
                                            )}
                                          </div>
                                          <div className="card-sectors">
                                            <span>S1: {formatSectorTime(lap.sector1_ms)}</span>
                                            <span>S2: {formatSectorTime(lap.sector2_ms)}</span>
                                            <span>S3: {formatSectorTime(lap.sector3_ms)}</span>
                                          </div>
                                          <div className="card-actions">
                                            <button
                                              type="button"
                                              className="card-btn-a"
                                              onClick={() => onSetLapA(lap.id)}
                                            >
                                              {isLapA ? 'Base ✓' : 'Base'}
                                            </button>
                                            <button
                                              type="button"
                                              className="card-btn-b"
                                              onClick={() => onSetLapB(lap.id)}
                                            >
                                              {isLapB ? 'Comp ✓' : 'Comp'}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
