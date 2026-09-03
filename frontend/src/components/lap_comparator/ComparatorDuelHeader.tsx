import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Gauge,
  Timer,
  ArrowLeftRight,
  Zap,
  Link,
  Unlink,
  X,
  ChevronDown,
  ChevronUp,
  User,
  Activity,
  Clock,
  Search,
} from 'lucide-react';
import { SessionSelectorDropdown } from './SessionSelectorDropdown';
import { TyreCompoundBadge } from '../common/TyreCompoundBadge';
import { formatTime, formatSectorTime } from '../../utils/formatters';
import { sortLapsByQuality } from '../../utils/lapUtils';
import { TEAM_COLORS } from '../../constants/f1';
import { useI18n } from '../../context/I18nContext';
import type { Session, Participant, Lap } from '../../types/session';
import type { SessionTypeTab } from '../../hooks/useComparatorSessions';

export interface ComparatorDuelHeaderProps {
  sessions: Session[];
  selectedSessionAObj?: Session;
  selectedSessionBObj?: Session;
  isLinkedSessions: boolean;
  toggleSessionLink: () => void;
  lapAObj?: Lap;
  lapBObj?: Lap;
  totalDeltaMs: number | null;
  handleSwapSlots: () => void;
  isTimingTowerOpen: boolean;
  setIsTimingTowerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  timingTowerTotalCount: number;
  handleClearSelections: () => void;
  slotA: {
    driver?: Participant;
    laps: Lap[];
    participants: Participant[];
    lapId: number | '';
    setLapId: (id: number | '') => void;
  };
  slotB: {
    driver?: Participant;
    laps: Lap[];
    participants: Participant[];
    lapId: number | '';
    setLapId: (id: number | '') => void;
  };
  filteredDropdownSessionsA: Session[];
  filteredDropdownSessionsB: Session[];
  isSessionADropdownOpen: boolean;
  setIsSessionADropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSessionBDropdownOpen: boolean;
  setIsSessionBDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sessionASearchQuery: string;
  setSessionASearchQuery: (q: string) => void;
  sessionBSearchQuery: string;
  setSessionBSearchQuery: (q: string) => void;
  sessionATypeTab: SessionTypeTab;
  setSessionATypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  sessionBTypeTab: SessionTypeTab;
  setSessionBTypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  handleSelectSessionA: (sessionId: number) => void;
  handleSelectSessionB: (sessionId: number) => void;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
}

export const ComparatorDuelHeader: React.FC<ComparatorDuelHeaderProps> = ({
  sessions,
  selectedSessionAObj,
  selectedSessionBObj,
  isLinkedSessions,
  toggleSessionLink,
  lapAObj,
  lapBObj,
  totalDeltaMs,
  handleSwapSlots,
  isTimingTowerOpen,
  setIsTimingTowerOpen,
  timingTowerTotalCount,
  handleClearSelections,
  slotA,
  slotB,
  filteredDropdownSessionsA,
  filteredDropdownSessionsB,
  isSessionADropdownOpen,
  setIsSessionADropdownOpen,
  isSessionBDropdownOpen,
  setIsSessionBDropdownOpen,
  sessionASearchQuery,
  setSessionASearchQuery,
  sessionBSearchQuery,
  setSessionBSearchQuery,
  sessionATypeTab,
  setSessionATypeTab,
  sessionBTypeTab,
  setSessionBTypeTab,
  handleSelectSessionA,
  handleSelectSessionB,
  s1Delta,
  s2Delta,
  s3Delta,
}) => {
  const { t } = useI18n();

  // Local popover states for Slot A & Slot B
  const [isDriverSelectorOpenA, setIsDriverSelectorOpenA] = useState(false);
  const [isDriverSelectorOpenB, setIsDriverSelectorOpenB] = useState(false);
  const [isLapSelectorOpenA, setIsLapSelectorOpenA] = useState(false);
  const [isLapSelectorOpenB, setIsLapSelectorOpenB] = useState(false);

  const [driverSearchA, setDriverSearchA] = useState('');
  const [driverSearchB, setDriverSearchB] = useState('');

  const slotARef = useRef<HTMLDivElement>(null);
  const slotBRef = useRef<HTMLDivElement>(null);

  // Close driver/lap popovers on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (slotARef.current && !slotARef.current.contains(e.target as Node)) {
        setIsDriverSelectorOpenA(false);
        setIsLapSelectorOpenA(false);
      }
      if (slotBRef.current && !slotBRef.current.contains(e.target as Node)) {
        setIsDriverSelectorOpenB(false);
        setIsLapSelectorOpenB(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filtered driver lists for Slot A & B popovers
  const filteredParticipantsA = useMemo(() => {
    const q = driverSearchA.trim().toLowerCase();
    if (!q) return slotA.participants;
    return slotA.participants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.race_number.toString().includes(q)
    );
  }, [slotA.participants, driverSearchA]);

  const filteredParticipantsB = useMemo(() => {
    const q = driverSearchB.trim().toLowerCase();
    if (!q) return slotB.participants;
    return slotB.participants.filter(
      (p) => p.name.toLowerCase().includes(q) || p.race_number.toString().includes(q)
    );
  }, [slotB.participants, driverSearchB]);

  // Laps for Slot A & B driver
  const driverLapsA = useMemo(() => {
    if (!slotA.driver) return [];
    return slotA.laps.filter((l) => (l.car_index ?? -1) === slotA.driver?.car_index);
  }, [slotA.laps, slotA.driver]);

  const driverLapsB = useMemo(() => {
    if (!slotB.driver) return [];
    return slotB.laps.filter((l) => (l.car_index ?? -1) === slotB.driver?.car_index);
  }, [slotB.laps, slotB.driver]);

  // Handler to pick driver in Slot A: loads their best valid lap
  const handleSelectDriverA = (p: Participant) => {
    const candidateLaps = sortLapsByQuality(slotA.laps.filter((l) => (l.car_index ?? -1) === p.car_index));
    if (candidateLaps.length > 0) {
      slotA.setLapId(candidateLaps[0].id);
    }
    setIsDriverSelectorOpenA(false);
  };

  // Handler to pick driver in Slot B: loads their best valid lap
  const handleSelectDriverB = (p: Participant) => {
    const candidateLaps = sortLapsByQuality(slotB.laps.filter((l) => (l.car_index ?? -1) === p.car_index));
    if (candidateLaps.length > 0) {
      slotB.setLapId(candidateLaps[0].id);
    }
    setIsDriverSelectorOpenB(false);
  };

  const teamColorA = slotA.driver ? TEAM_COLORS[slotA.driver.team_id] || '#ff4757' : '#ff4757';
  const teamColorB = slotB.driver ? TEAM_COLORS[slotB.driver.team_id] || '#00d2d3' : '#00d2d3';

  return (
    <div
      className="glass-panel comparator-duel-header-panel"
      style={{
        gridColumn: 'span 12',
        padding: '1.25rem 1.5rem',
        position: 'relative',
        zIndex: 80,
      }}
    >
      {/* Title & Subtitle Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
            <Gauge color="var(--accent-primary)" size={26} /> {t('comparator.title')}
          </h2>
          <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
            {t('comparator.subtitle')}
          </p>
        </div>
      </div>

      {/* Top Toolbar: Session Selectors & Actions */}
      <div className="duel-top-toolbar">
        {/* Left: Circuit & Session Selector(s) */}
        <div className="duel-session-controls">
          <div className="duel-session-picker">
            <span className="duel-session-label">{t('comparator.duel.slotASession')}</span>
            <SessionSelectorDropdown
              sessions={sessions}
              filteredSessions={filteredDropdownSessionsA}
              selectedSession={selectedSessionAObj}
              isOpen={isSessionADropdownOpen}
              onToggleOpen={() => setIsSessionADropdownOpen((prev) => !prev)}
              searchQuery={sessionASearchQuery}
              onSearchChange={setSessionASearchQuery}
              typeTab={sessionATypeTab}
              onTypeTabChange={setSessionATypeTab}
              onSelectSession={handleSelectSessionA}
              slot="A"
              accentColor="#ff4757"
              placeholder={t('comparator.duel.selectSessionA')}
            />
          </div>

          {/* Session Link / Unlink Toggle Button */}
          {selectedSessionAObj && sessions.length > 1 && (
            <button
              type="button"
              onClick={toggleSessionLink}
              className={`duel-link-toggle-btn ${isLinkedSessions ? 'is-linked' : 'is-unlinked'}`}
              title={isLinkedSessions ? t('comparator.linkedTitle') : t('comparator.crossSessionTitle')}
              data-testid="session-sync-toggle"
            >
              {isLinkedSessions ? <Link size={14} /> : <Unlink size={14} />}
              <span>{isLinkedSessions ? t('comparator.linked') : t('comparator.crossSession')}</span>
            </button>
          )}

          {/* Slot B Session Picker (revealed when unlinked) */}
          {!isLinkedSessions && (
            <div className="duel-session-picker slot-b-session">
              <span className="duel-session-label">{t('comparator.duel.slotBSession')}</span>
              <SessionSelectorDropdown
                sessions={sessions}
                filteredSessions={filteredDropdownSessionsB}
                selectedSession={selectedSessionBObj}
                isOpen={isSessionBDropdownOpen}
                onToggleOpen={() => setIsSessionBDropdownOpen((prev) => !prev)}
                searchQuery={sessionBSearchQuery}
                onSearchChange={setSessionBSearchQuery}
                typeTab={sessionBTypeTab}
                onTypeTabChange={setSessionBTypeTab}
                onSelectSession={handleSelectSessionB}
                slot="B"
                accentColor="#00d2d3"
                placeholder={t('comparator.duel.selectSessionB')}
                isRestrictedCircuit={!isLinkedSessions}
                restrictedTrackName={selectedSessionAObj?.track_name}
              />
            </div>
          )}
        </div>

        {/* Right: Quick Global Actions (Swap, Clear) */}
        <div className="duel-action-controls">
          {lapAObj && lapBObj && (
            <button
              type="button"
              onClick={handleSwapSlots}
              className="duel-btn duel-swap-btn"
              title={t('comparator.swapTitle')}
              data-testid="duel-swap-slots-btn"
            >
              <ArrowLeftRight size={13} />
              <span>{t('comparator.swap')}</span>
            </button>
          )}

          {(slotA.lapId || slotB.lapId) && (
            <button
              type="button"
              onClick={handleClearSelections}
              className="duel-btn duel-clear-btn"
              title={t('comparator.clearTitle')}
              data-testid="duel-clear-selections-btn"
            >
              <X size={13} />
              <span>{t('comparator.clear')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Duel Matchup Bar */}
      <div className="duel-matchup-container">
        {/* SLOT A: BASELINE CARD */}
        <div
          ref={slotARef}
          className={`duel-slot-card slot-a ${lapAObj ? 'has-lap' : 'empty'}`}
          data-testid="duel-slot-a"
        >
          <div className="duel-slot-header">
            <div className="duel-slot-tag slot-a-tag">
              <span className="dot" />
              <span>{t('comparator.duel.baseline')} (Slot A)</span>
            </div>
            {lapAObj?.max_speed_kmh && (
              <span className="duel-speed-pill">
                {Math.round(lapAObj.max_speed_kmh)} km/h
              </span>
            )}
          </div>

          {/* Driver Selection Row */}
          <div className="duel-driver-row">
            <div className="duel-driver-info">
              <span className="duel-team-stripe" style={{ backgroundColor: teamColorA }} />
              {slotA.driver ? (
                <button
                  type="button"
                  className="duel-driver-chip"
                  onClick={() => {
                    setIsDriverSelectorOpenA((prev) => !prev);
                    setIsLapSelectorOpenA(false);
                  }}
                  title="Click to switch driver"
                  data-testid="slot-a-driver-trigger"
                >
                  <span className="duel-driver-num">#{slotA.driver.race_number}</span>
                  <span className="duel-driver-name">{slotA.driver.name}</span>
                  <ChevronDown size={14} className="chevron-icon" />
                </button>
              ) : (
                <button
                  type="button"
                  className="duel-driver-chip empty"
                  onClick={() => {
                    setIsDriverSelectorOpenA((prev) => !prev);
                    setIsLapSelectorOpenA(false);
                  }}
                  data-testid="slot-a-driver-trigger-empty"
                >
                  <User size={14} />
                  <span>{t('comparator.duel.selectDriver')}</span>
                  <ChevronDown size={14} />
                </button>
              )}
            </div>

            {/* Lap Selection Trigger */}
            <div className="duel-lap-picker-wrapper">
              {lapAObj ? (
                <button
                  type="button"
                  className="duel-lap-chip slot-a-lap"
                  onClick={() => {
                    setIsLapSelectorOpenA((prev) => !prev);
                    setIsDriverSelectorOpenA(false);
                  }}
                  data-testid="lap-a-trigger"
                >
                  <span className="duel-lap-num">L{lapAObj.lap_number}</span>
                  <span className="duel-lap-time">{formatTime(lapAObj.lap_time_ms)}</span>
                  {lapAObj.tyre_compound && (
                    <TyreCompoundBadge compound={lapAObj.tyre_compound} />
                  )}
                  {lapAObj.has_telemetry ? (
                    <Activity size={12} className="telemetry-icon has-telemetry" />
                  ) : (
                    <Clock size={12} className="telemetry-icon timing-only" />
                  )}
                  {!lapAObj.is_valid && (
                    <span className="invalid-badge">{t('comparator.invalid')}</span>
                  )}
                  <ChevronDown size={13} className="chevron-icon" />
                </button>
              ) : (
                <button
                  type="button"
                  className="duel-lap-chip empty"
                  onClick={() => {
                    setIsLapSelectorOpenA((prev) => !prev);
                    setIsDriverSelectorOpenA(false);
                  }}
                  data-testid="slot-a-lap-trigger-empty"
                >
                  <span>{t('comparator.duel.selectLap')}</span>
                  <ChevronDown size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Popover: Driver List for Slot A */}
          {isDriverSelectorOpenA && (
            <div className="duel-popover driver-popover" data-testid="slot-a-driver-popover">
              <div className="duel-popover-search">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search driver or number..."
                  value={driverSearchA}
                  onChange={(e) => setDriverSearchA(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="duel-popover-list">
                {filteredParticipantsA.map((p) => {
                  const pTeamColor = TEAM_COLORS[p.team_id] || '#888';
                  const bestLap = sortLapsByQuality(slotA.laps.filter((l) => (l.car_index ?? -1) === p.car_index))[0];
                  return (
                    <button
                      key={`part-a-${p.car_index}`}
                      type="button"
                      className={`duel-popover-item ${slotA.driver?.car_index === p.car_index ? 'active' : ''}`}
                      onClick={() => handleSelectDriverA(p)}
                    >
                      <div className="popover-item-left">
                        <span className="team-indicator" style={{ backgroundColor: pTeamColor }} />
                        <span className="driver-num">#{p.race_number}</span>
                        <span className="driver-name">{p.name}</span>
                      </div>
                      {bestLap && (
                        <div className="popover-item-right">
                          <span className="best-time">{formatTime(bestLap.lap_time_ms)}</span>
                          {bestLap.tyre_compound && <TyreCompoundBadge compound={bestLap.tyre_compound} />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Popover: Lap List for Slot A */}
          {isLapSelectorOpenA && (
            <div className="duel-popover lap-popover" data-testid="slot-a-lap-popover">
              <div className="duel-popover-header">
                <span>{slotA.driver ? `${slotA.driver.name} - Laps` : 'All Laps'}</span>
                <span className="laps-count">{driverLapsA.length} laps</span>
              </div>
              <div className="duel-popover-list">
                {driverLapsA.map((l) => {
                  const isSelected = slotA.lapId === l.id;
                  return (
                    <button
                      key={`lap-a-${l.id}`}
                      type="button"
                      className={`duel-popover-item lap-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        slotA.setLapId(l.id);
                        setIsLapSelectorOpenA(false);
                      }}
                    >
                      <div className="popover-lap-left">
                        <span className="lap-num">Lap {l.lap_number}</span>
                        <span className="lap-time">{formatTime(l.lap_time_ms)}</span>
                        {l.tyre_compound && <TyreCompoundBadge compound={l.tyre_compound} />}
                      </div>
                      <div className="popover-lap-right">
                        {l.sector1_ms && l.sector2_ms && l.sector3_ms ? (
                          <div className="sectors-mini">
                            <span>S1: {formatSectorTime(l.sector1_ms)}</span>
                            <span>S2: {formatSectorTime(l.sector2_ms)}</span>
                            <span>S3: {formatSectorTime(l.sector3_ms)}</span>
                          </div>
                        ) : null}
                        {l.has_telemetry ? (
                          <span className="telemetry-badge active" title="Telemetry available">
                            <Activity size={10} />
                          </span>
                        ) : (
                          <span className="telemetry-badge timing" title="Timing only">
                            <Clock size={10} />
                          </span>
                        )}
                        {!l.is_valid && <span className="invalid-tag">INV</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CENTER MATCHUP & DELTA DISPLAY */}
        <div className="duel-center-matchup">
          {lapAObj && lapBObj && totalDeltaMs !== null ? (
            <div className="duel-delta-container">
              <div
                className="duel-delta-badge"
                data-faster={totalDeltaMs < 0 ? 'a' : totalDeltaMs > 0 ? 'b' : 'equal'}
                data-testid="duel-delta-badge"
              >
                <Timer size={15} />
                <span className="delta-value">
                  {totalDeltaMs === 0
                    ? t('comparator.identicalLaps')
                    : totalDeltaMs < 0
                    ? `Δ -${(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s (${slotA.driver?.name?.split(' ').pop() || 'A'})`
                    : `Δ -${(Math.abs(totalDeltaMs) / 1000).toFixed(3)}s (${slotB.driver?.name?.split(' ').pop() || 'B'})`}
                </span>
              </div>

              {/* Micro Sector Deltas */}
              {(s1Delta !== null || s2Delta !== null || s3Delta !== null) && (
                <div className="duel-sector-deltas">
                  {s1Delta !== null && (
                    <span
                      className="duel-sector-pill"
                      data-delta={s1Delta < 0 ? 'faster-a' : s1Delta > 0 ? 'faster-b' : 'equal'}
                    >
                      S1: {s1Delta <= 0 ? '' : '+'}{(s1Delta / 1000).toFixed(3)}s
                    </span>
                  )}
                  {s2Delta !== null && (
                    <span
                      className="duel-sector-pill"
                      data-delta={s2Delta < 0 ? 'faster-a' : s2Delta > 0 ? 'faster-b' : 'equal'}
                    >
                      S2: {s2Delta <= 0 ? '' : '+'}{(s2Delta / 1000).toFixed(3)}s
                    </span>
                  )}
                  {s3Delta !== null && (
                    <span
                      className="duel-sector-pill"
                      data-delta={s3Delta < 0 ? 'faster-a' : s3Delta > 0 ? 'faster-b' : 'equal'}
                    >
                      S3: {s3Delta <= 0 ? '' : '+'}{(s3Delta / 1000).toFixed(3)}s
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="duel-vs-circle">
              <span>VS</span>
            </div>
          )}

          {/* Timing Tower Toggle Button */}
          {timingTowerTotalCount > 0 && (
            <button
              type="button"
              className={`duel-tower-toggle-btn ${isTimingTowerOpen ? 'is-open' : ''}`}
              onClick={() => setIsTimingTowerOpen((prev) => !prev)}
              data-testid="toggle-quick-select-toolbar-btn"
            >
              <Zap size={13} />
              <span>{t('comparator.timingTower.title')} ({timingTowerTotalCount})</span>
              {isTimingTowerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>

        {/* SLOT B: RIVAL CARD */}
        <div
          ref={slotBRef}
          className={`duel-slot-card slot-b ${lapBObj ? 'has-lap' : 'empty'}`}
          data-testid="duel-slot-b"
        >
          <div className="duel-slot-header">
            <div className="duel-slot-tag slot-b-tag">
              <span className="dot" />
              <span>{t('comparator.duel.rival')} (Slot B)</span>
            </div>
            {lapBObj?.max_speed_kmh && (
              <span className="duel-speed-pill">
                {Math.round(lapBObj.max_speed_kmh)} km/h
              </span>
            )}
          </div>

          {/* Driver Selection Row */}
          <div className="duel-driver-row">
            <div className="duel-driver-info">
              <span className="duel-team-stripe" style={{ backgroundColor: teamColorB }} />
              {slotB.driver ? (
                <button
                  type="button"
                  className="duel-driver-chip"
                  onClick={() => {
                    setIsDriverSelectorOpenB((prev) => !prev);
                    setIsLapSelectorOpenB(false);
                  }}
                  title="Click to switch driver"
                  data-testid="slot-b-driver-trigger"
                >
                  <span className="duel-driver-num">#{slotB.driver.race_number}</span>
                  <span className="duel-driver-name">{slotB.driver.name}</span>
                  <ChevronDown size={14} className="chevron-icon" />
                </button>
              ) : (
                <button
                  type="button"
                  className="duel-driver-chip empty"
                  onClick={() => {
                    setIsDriverSelectorOpenB((prev) => !prev);
                    setIsLapSelectorOpenB(false);
                  }}
                  data-testid="slot-b-driver-trigger-empty"
                >
                  <User size={14} />
                  <span>{t('comparator.duel.selectDriver')}</span>
                  <ChevronDown size={14} />
                </button>
              )}
            </div>

            {/* Lap Selection Trigger */}
            <div className="duel-lap-picker-wrapper">
              {lapBObj ? (
                <button
                  type="button"
                  className="duel-lap-chip slot-b-lap"
                  onClick={() => {
                    setIsLapSelectorOpenB((prev) => !prev);
                    setIsDriverSelectorOpenB(false);
                  }}
                  data-testid="lap-b-trigger"
                >
                  <span className="duel-lap-num">L{lapBObj.lap_number}</span>
                  <span className="duel-lap-time">{formatTime(lapBObj.lap_time_ms)}</span>
                  {lapBObj.tyre_compound && (
                    <TyreCompoundBadge compound={lapBObj.tyre_compound} />
                  )}
                  {lapBObj.has_telemetry ? (
                    <Activity size={12} className="telemetry-icon has-telemetry" />
                  ) : (
                    <Clock size={12} className="telemetry-icon timing-only" />
                  )}
                  {!lapBObj.is_valid && (
                    <span className="invalid-badge">{t('comparator.invalid')}</span>
                  )}
                  <ChevronDown size={13} className="chevron-icon" />
                </button>
              ) : (
                <button
                  type="button"
                  className="duel-lap-chip empty"
                  onClick={() => {
                    setIsLapSelectorOpenB((prev) => !prev);
                    setIsDriverSelectorOpenB(false);
                  }}
                  data-testid="slot-b-lap-trigger-empty"
                >
                  <span>{t('comparator.duel.selectLap')}</span>
                  <ChevronDown size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Popover: Driver List for Slot B */}
          {isDriverSelectorOpenB && (
            <div className="duel-popover driver-popover" data-testid="slot-b-driver-popover">
              <div className="duel-popover-search">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Search driver or number..."
                  value={driverSearchB}
                  onChange={(e) => setDriverSearchB(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="duel-popover-list">
                {filteredParticipantsB.map((p) => {
                  const pTeamColor = TEAM_COLORS[p.team_id] || '#888';
                  const bestLap = sortLapsByQuality(slotB.laps.filter((l) => (l.car_index ?? -1) === p.car_index))[0];
                  return (
                    <button
                      key={`part-b-${p.car_index}`}
                      type="button"
                      className={`duel-popover-item ${slotB.driver?.car_index === p.car_index ? 'active' : ''}`}
                      onClick={() => handleSelectDriverB(p)}
                    >
                      <div className="popover-item-left">
                        <span className="team-indicator" style={{ backgroundColor: pTeamColor }} />
                        <span className="driver-num">#{p.race_number}</span>
                        <span className="driver-name">{p.name}</span>
                      </div>
                      {bestLap && (
                        <div className="popover-item-right">
                          <span className="best-time">{formatTime(bestLap.lap_time_ms)}</span>
                          {bestLap.tyre_compound && <TyreCompoundBadge compound={bestLap.tyre_compound} />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Popover: Lap List for Slot B */}
          {isLapSelectorOpenB && (
            <div className="duel-popover lap-popover" data-testid="slot-b-lap-popover">
              <div className="duel-popover-header">
                <span>{slotB.driver ? `${slotB.driver.name} - Laps` : 'All Laps'}</span>
                <span className="laps-count">{driverLapsB.length} laps</span>
              </div>
              <div className="duel-popover-list">
                {driverLapsB.map((l) => {
                  const isSelected = slotB.lapId === l.id;
                  return (
                    <button
                      key={`lap-b-${l.id}`}
                      type="button"
                      className={`duel-popover-item lap-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        slotB.setLapId(l.id);
                        setIsLapSelectorOpenB(false);
                      }}
                    >
                      <div className="popover-lap-left">
                        <span className="lap-num">Lap {l.lap_number}</span>
                        <span className="lap-time">{formatTime(l.lap_time_ms)}</span>
                        {l.tyre_compound && <TyreCompoundBadge compound={l.tyre_compound} />}
                      </div>
                      <div className="popover-lap-right">
                        {l.sector1_ms && l.sector2_ms && l.sector3_ms ? (
                          <div className="sectors-mini">
                            <span>S1: {formatSectorTime(l.sector1_ms)}</span>
                            <span>S2: {formatSectorTime(l.sector2_ms)}</span>
                            <span>S3: {formatSectorTime(l.sector3_ms)}</span>
                          </div>
                        ) : null}
                        {l.has_telemetry ? (
                          <span className="telemetry-badge active" title="Telemetry available">
                            <Activity size={10} />
                          </span>
                        ) : (
                          <span className="telemetry-badge timing" title="Timing only">
                            <Clock size={10} />
                          </span>
                        )}
                        {!l.is_valid && <span className="invalid-tag">INV</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
