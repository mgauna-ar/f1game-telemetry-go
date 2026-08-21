import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Gauge,
  MapPin,
  Timer,
  ArrowLeftRight,
  Zap,
  Link,
  Unlink,
  Sparkles,
} from 'lucide-react';

import type { NavigationComparatorPayload } from '../types/session';
import { buildTelemetryContext } from '../utils/aiTelemetrySummary';
import { getTurnContextAtDistance } from '../utils/trackTurns';
import { ComparatorTrackMap } from './ComparatorTrackMap';
import { TrackFlag } from './TrackFlag';
import { useRaceEngineer } from '../context/RaceEngineerContext';
import { useI18n } from '../context/I18nContext';
import { ERS_MODE_NAMES } from '../constants/f1';
import { formatTime } from '../utils/formatters';

import { SlotCard } from './lap_comparator/SlotCard';
import { QuickSelectLeaderboard } from './lap_comparator/QuickSelectLeaderboard';
import { ComparatorMetricsSummary } from './lap_comparator/ComparatorMetricsSummary';
import { ComparatorTelemetryCharts } from './lap_comparator/ComparatorTelemetryCharts';

import { useComparatorSessions } from '../hooks/useComparatorSessions';
import { useSlotTelemetry } from '../hooks/useSlotTelemetry';
import { useMergedTelemetry } from '../hooks/useMergedTelemetry';

export interface LapComparatorProps {
  initialPreload?: NavigationComparatorPayload | null;
}

export const LapComparator: React.FC<LapComparatorProps> = ({ initialPreload }) => {
  const { t } = useI18n();
  const { setComparatorContext, setContextMode, openChat } = useRaceEngineer();

  // Hook 1: Session selection & Synchronization link
  const {
    sessions,
    sessionAId,
    setSessionAId,
    sessionBId,
    setSessionBId,
    isLinkedSessions,
    isSessionADropdownOpen,
    setIsSessionADropdownOpen,
    sessionASearchQuery,
    setSessionASearchQuery,
    sessionATypeTab,
    setSessionATypeTab,
    sessionADropdownRef,
    isSessionBDropdownOpen,
    setIsSessionBDropdownOpen,
    sessionBSearchQuery,
    setSessionBSearchQuery,
    sessionBTypeTab,
    setSessionBTypeTab,
    sessionBDropdownRef,
    handleSelectSessionA,
    handleSelectSessionB,
    toggleSessionLink,
    selectedSessionAObj,
    selectedSessionBObj,
    filteredDropdownSessionsA,
    filteredDropdownSessionsB,
  } = useComparatorSessions({ initialPreload });

  // Hook 2: Slot A telemetry & laps loader
  const slotA = useSlotTelemetry({
    sessionId: sessionAId,
    preloadLapId: initialPreload?.lapAId || (initialPreload?.slot === 'A' ? initialPreload?.lapId : undefined),
    defaultDriverName: 'Lap A',
  });

  // Hook 2 (reused): Slot B telemetry & laps loader
  const slotB = useSlotTelemetry({
    sessionId: sessionBId,
    preloadLapId: initialPreload?.lapBId || (initialPreload?.slot === 'B' ? initialPreload?.lapId : undefined),
    isSlotB: true,
    isSameSessionAsSlotA: sessionAId === sessionBId,
    defaultDriverName: 'Lap B',
  });

  // Hook 3: Merged telemetry & delta computations
  const {
    comparisonData,
    detectedTurns,
    chartData,
    sector1Distance,
    sector2Distance,
    totalDeltaMs,
    s1Delta,
    s2Delta,
    s3Delta,
    hoverDistance,
    setHoverDistance,
    zoomDomain,
    setZoomDomain,
    handleMouseMove,
  } = useMergedTelemetry({
    rawTelemetryA: slotA.rawTelemetry,
    rawTelemetryB: slotB.rawTelemetry,
    lapAObj: slotA.selectedLap,
    lapBObj: slotB.selectedLap,
  });

  // Aliases for clear JSX consumption
  const lapAObj = slotA.selectedLap;
  const lapBObj = slotB.selectedLap;
  const driverA = slotA.driver;
  const driverB = slotB.driver;
  const nameA = slotA.driverName;
  const nameB = slotB.driverName;
  const lapAId = slotA.lapId;
  const lapBId = slotB.lapId;
  const lapsA = slotA.laps;
  const lapsB = slotB.laps;
  const participantsA = slotA.participants;
  const participantsB = slotB.participants;
  const loadingA = slotA.loading;
  const loadingB = slotB.loading;
  const activeParticipantsA = slotA.activeParticipants;
  const activeParticipantsB = slotB.activeParticipants;
  const setLapAId = slotA.setLapId;
  const setLapBId = slotB.setLapId;

  // Quick Select Leaderboard State
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('f1_comparator_quick_select_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
  const [quickSelectSessionTab, setQuickSelectSessionTab] = useState<'ALL' | 'A' | 'B'>('ALL');

  useEffect(() => {
    try {
      localStorage.setItem('f1_comparator_quick_select_open', String(isQuickSelectOpen));
    } catch {
      // ignore localStorage write errors
    }
  }, [isQuickSelectOpen]);

  // Telemetry summary context for AI Race Engineer
  const telemetryContext = useMemo(() => {
    return buildTelemetryContext(
      selectedSessionAObj?.track_name || '',
      selectedSessionAObj?.session_type || '',
      lapAObj,
      lapBObj,
      nameA,
      nameB,
      comparisonData,
      zoomDomain,
      selectedSessionBObj?.session_type || selectedSessionAObj?.session_type,
      selectedSessionAObj?.weather,
      selectedSessionBObj?.weather
    );
  }, [selectedSessionAObj, selectedSessionBObj, lapAObj, lapBObj, nameA, nameB, comparisonData, zoomDomain]);

  useEffect(() => {
    setComparatorContext(telemetryContext);
    setContextMode('comparator');
  }, [telemetryContext, setComparatorContext, setContextMode]);

  // Quick Select Leaderboard data computation
  const quickSelectData = useMemo(() => {
    const driversA = activeParticipantsA.map((p) => ({
      ...p,
      sessionSlot: 'A' as const,
      sessionTrack: selectedSessionAObj?.track_name,
      sessionType: selectedSessionAObj?.session_type,
    }));
    const driversB = activeParticipantsB.map((p) => ({
      ...p,
      sessionSlot: 'B' as const,
      sessionTrack: selectedSessionBObj?.track_name,
      sessionType: selectedSessionBObj?.session_type,
    }));

    let candidateList: Array<typeof driversA[0] | typeof driversB[0]>;
    if (isLinkedSessions || sessionAId === sessionBId) {
      candidateList = driversA;
    } else {
      if (quickSelectSessionTab === 'A') {
        candidateList = driversA;
      } else if (quickSelectSessionTab === 'B') {
        candidateList = driversB;
      } else {
        candidateList = [...driversA, ...driversB];
      }
    }

    const sorted = [...candidateList].sort((a, b) => {
      const timeA = a.bestLap && a.bestLap.lap_time_ms > 0 ? a.bestLap.lap_time_ms : Infinity;
      const timeB = b.bestLap && b.bestLap.lap_time_ms > 0 ? b.bestLap.lap_time_ms : Infinity;
      return timeA - timeB;
    });

    const leaderLapTimeMs = sorted.find((d) => d.bestLap && d.bestLap.lap_time_ms > 0)?.bestLap?.lap_time_ms ?? null;

    const q = driverSearchQuery.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.race_number.toString().includes(q) ||
            (d.bestLap?.tyre_compound && d.bestLap.tyre_compound.toLowerCase().includes(q))
        )
      : sorted;

    return {
      drivers: filtered,
      totalCount: sorted.length,
      leaderLapTimeMs,
    };
  }, [
    activeParticipantsA,
    activeParticipantsB,
    isLinkedSessions,
    sessionAId,
    sessionBId,
    quickSelectSessionTab,
    driverSearchQuery,
    selectedSessionAObj,
    selectedSessionBObj,
  ]);

  // Swap Slots handler
  const handleSwapSlots = () => {
    const tempSessionId = sessionAId;
    const tempLapId = lapAId;

    if (!isLinkedSessions) {
      setSessionAId(sessionBId);
      setSessionBId(tempSessionId);
    }
    setLapAId(lapBId);
    setLapBId(tempLapId);
  };

  // Clear selections
  const handleClearSelections = () => {
    setLapAId('');
    setLapBId('');
  };

  return (
    <div className="dashboard-grid" style={{ paddingTop: 0 }}>
      {/* Header Controls Panel */}
      <div
        className="glass-panel"
        style={{
          gridColumn: 'span 12',
          padding: '1.25rem 1.5rem',
          position: 'relative',
          zIndex: 80,
        }}
      >
        {/* Top Header Row: Title & Subtitle + Live Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
              <Gauge color="var(--accent-primary)" size={26} /> {t('comparator.title')}
            </h2>
            <p className="text-secondary" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              {t('comparator.subtitle')}
            </p>
          </div>

          {/* Live Badges and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {selectedSessionAObj && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <TrackFlag track={selectedSessionAObj.track_name} width={18} height={12} />
                <span>{selectedSessionAObj.track_name}</span>
                {!isLinkedSessions && selectedSessionBObj && selectedSessionBObj.id !== selectedSessionAObj.id && (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(255, 165, 2, 0.2)', color: '#ffa502', padding: '1px 6px', borderRadius: '10px' }}>
                    {t('comparator.crossSession')}
                  </span>
                )}
              </div>
            )}


            {/* Session Link / Unlink Toggle Button */}
            {selectedSessionAObj && sessions.length > 1 && (
              <button
                type="button"
                onClick={toggleSessionLink}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: isLinkedSessions ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 165, 2, 0.15)',
                  border: `1px solid ${isLinkedSessions ? 'rgba(0, 210, 211, 0.4)' : 'rgba(255, 165, 2, 0.5)'}`,
                  color: isLinkedSessions ? '#00d2d3' : '#ffa502',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={isLinkedSessions ? t('comparator.linkedTitle') : t('comparator.crossSessionTitle')}
                data-testid="session-sync-toggle"
              >
                {isLinkedSessions ? <Link size={14} /> : <Unlink size={14} />}
                <span>{isLinkedSessions ? t('comparator.linked') : t('comparator.crossSession')}</span>
              </button>
            )}

            {lapAObj && lapBObj && totalDeltaMs !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: totalDeltaMs < 0 ? 'rgba(255, 71, 87, 0.15)' : totalDeltaMs > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : 'rgba(255, 255, 255, 0.2)'}`,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: totalDeltaMs < 0 ? '#ff4757' : totalDeltaMs > 0 ? '#00d2d3' : '#fff',
                }}
              >
                <Timer size={14} />
                <span>
                  {totalDeltaMs < 0
                    ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapA') })
                    : totalDeltaMs > 0
                    ? t('comparator.deltaLap', { delta: (Math.abs(totalDeltaMs) / 1000).toFixed(3), lap: t('comparator.lapB') })
                    : t('comparator.identicalLaps')}
                </span>
              </div>
            )}

            {lapAObj && lapBObj && (
              <button
                type="button"
                onClick={handleSwapSlots}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={t('comparator.swapTitle')}
              >
                <ArrowLeftRight size={13} /> {t('comparator.swap')}
              </button>
            )}

            {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
              <button
                type="button"
                onClick={() => setIsQuickSelectOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: isQuickSelectOpen ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${isQuickSelectOpen ? 'rgba(0, 210, 211, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                  color: isQuickSelectOpen ? '#00d2d3' : 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={isQuickSelectOpen ? t('comparator.collapseDrivers') : t('comparator.expandDrivers')}
                data-testid="toggle-quick-select-toolbar-btn"
              >
                <Zap size={13} color={isQuickSelectOpen ? '#00d2d3' : 'var(--accent-primary)'} />
                <span>{t('comparator.drivers', { count: quickSelectData.totalCount })}</span>
              </button>
            )}

            {(lapAId || lapBId) && (
              <button
                type="button"
                onClick={handleClearSelections}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '20px',
                  background: 'rgba(255, 71, 87, 0.1)',
                  border: '1px solid rgba(255, 71, 87, 0.3)',
                  color: '#ff4757',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={t('comparator.clearTitle')}
              >
                <X size={13} /> {t('comparator.clear')}
              </button>
            )}
          </div>
        </div>

        {/* SIDE-BY-SIDE COMPARISON SLOTS CONTAINER */}
        <div className="comparator-slots-container">
          {/* SLOT A CARD */}
          <SlotCard
            slot="A"
            title={t('comparator.slotABaseline')}
            accentColor="#ff4757"
            driver={driverA}
            sessions={sessions}
            filteredSessions={filteredDropdownSessionsA}
            selectedSession={selectedSessionAObj}
            isSessionDropdownOpen={isSessionADropdownOpen}
            onToggleSessionDropdown={() => setIsSessionADropdownOpen((prev) => !prev)}
            dropdownRef={sessionADropdownRef}
            sessionSearchQuery={sessionASearchQuery}
            onSessionSearchChange={setSessionASearchQuery}
            sessionTypeTab={sessionATypeTab}
            onSessionTypeTabChange={setSessionATypeTab}
            onSelectSession={handleSelectSessionA}
            laps={lapsA}
            participants={participantsA}
            selectedLapId={lapAId}
            onSelectLap={(id) => setLapAId(id)}
          />

          {/* SLOT B CARD */}
          <SlotCard
            slot="B"
            title={t('comparator.slotBComparison')}
            accentColor="#00d2d3"
            driver={driverB}
            sessions={sessions}
            filteredSessions={filteredDropdownSessionsB}
            selectedSession={selectedSessionBObj}
            isSessionDropdownOpen={isSessionBDropdownOpen}
            onToggleSessionDropdown={() => setIsSessionBDropdownOpen((prev) => !prev)}
            dropdownRef={sessionBDropdownRef}
            sessionSearchQuery={sessionBSearchQuery}
            onSessionSearchChange={setSessionBSearchQuery}
            sessionTypeTab={sessionBTypeTab}
            onSessionTypeTabChange={setSessionBTypeTab}
            onSelectSession={handleSelectSessionB}
            laps={lapsB}
            participants={participantsB}
            selectedLapId={lapBId}
            onSelectLap={(id) => setLapBId(id)}
            isRestrictedCircuit={!isLinkedSessions}
            restrictedTrackName={selectedSessionAObj?.track_name}
          />
        </div>

        {/* Bottom Detailed Telemetry Summary & Sector Deltas Bar */}
        {(lapAObj || lapBObj) && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Left: Selected Laps Summary Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              {lapAObj && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff4757', display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: '#fff' }}>Lap A:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#ff4757', fontWeight: 700 }}>{formatTime(lapAObj.lap_time_ms)}</span>
                  {driverA && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({driverA.name})</span>}
                  {lapAObj.max_speed_kmh && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', color: '#ff4757', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {Math.round(lapAObj.max_speed_kmh)} km/h
                    </span>
                  )}
                  {!lapAObj.is_valid && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Invalid
                    </span>
                  )}
                </div>
              )}

              {lapAObj && lapBObj && <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />}

              {lapBObj && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d2d3', display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: '#fff' }}>Lap B:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#00d2d3', fontWeight: 700 }}>{formatTime(lapBObj.lap_time_ms)}</span>
                  {driverB && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({driverB.name})</span>}
                  {lapBObj.max_speed_kmh && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {Math.round(lapBObj.max_speed_kmh)} km/h
                    </span>
                  )}
                  {!lapBObj.is_valid && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Invalid
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Sector Deltas Chips (S1, S2, S3) */}
            {lapAObj && lapBObj && (s1Delta !== null || s2Delta !== null || s3Delta !== null) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sectors (Δ A vs B):</span>
                {s1Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s1Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s1Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s1Delta < 0 ? '#ff4757' : s1Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S1: {s1Delta <= 0 ? '' : '+'}{(s1Delta / 1000).toFixed(3)}s
                  </span>
                )}
                {s2Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s2Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s2Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s2Delta < 0 ? '#ff4757' : s2Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S2: {s2Delta <= 0 ? '' : '+'}{(s2Delta / 1000).toFixed(3)}s
                  </span>
                )}
                {s3Delta !== null && (
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: s3Delta < 0 ? 'rgba(255, 71, 87, 0.15)' : s3Delta > 0 ? 'rgba(0, 210, 211, 0.15)' : 'rgba(255,255,255,0.05)', color: s3Delta < 0 ? '#ff4757' : s3Delta > 0 ? '#00d2d3' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    S3: {s3Delta <= 0 ? '' : '+'}{(s3Delta / 1000).toFixed(3)}s
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Collapsible Quick Select Driver Leaderboard */}
      {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
        <QuickSelectLeaderboard
          isOpen={isQuickSelectOpen}
          onToggleOpen={() => setIsQuickSelectOpen((prev) => !prev)}
          quickSelectData={quickSelectData}
          driverSearchQuery={driverSearchQuery}
          onDriverSearchChange={setDriverSearchQuery}
          isLinkedSessions={isLinkedSessions}
          sessionAId={sessionAId}
          sessionBId={sessionBId}
          quickSelectSessionTab={quickSelectSessionTab}
          onQuickSelectSessionTabChange={setQuickSelectSessionTab}
          lapAId={lapAId}
          lapBId={lapBId}
          lapsA={lapsA}
          lapsB={lapsB}
          onSetLapA={(id) => setLapAId(id)}
          onSetLapB={(id) => setLapBId(id)}
          participantsA={participantsA}
        />
      )}

      {/* 2-COLUMN MAIN COMPARISON LAYOUT */}
      {sessionAId !== '' && (lapAObj || lapBObj) && (
        <div className="comparator-layout" style={{ gridColumn: 'span 12' }}>
          {/* LEFT COLUMN: Summary cards & Telemetry Charts Stack */}
          <div className="comparator-charts-col">
            <ComparatorMetricsSummary
              lapAObj={lapAObj}
              lapBObj={lapBObj}
              nameA={nameA}
              nameB={nameB}
              driverA={driverA}
              driverB={driverB}
              totalDeltaMs={totalDeltaMs}
              s1Delta={s1Delta}
              s2Delta={s2Delta}
              s3Delta={s3Delta}
            />

            <ComparatorTelemetryCharts
              chartData={chartData}
              comparisonData={comparisonData}
              nameA={nameA}
              nameB={nameB}
              formatA={selectedSessionAObj?.packet_format}
              formatB={selectedSessionBObj?.packet_format}
              hoverDistance={hoverDistance}
              onHoverDistanceChange={setHoverDistance}
              zoomDomain={zoomDomain}
              onZoomDomainChange={setZoomDomain}
              sector1Distance={sector1Distance}
              sector2Distance={sector2Distance}
              sessionAId={sessionAId}
              loadingA={loadingA}
              loadingB={loadingB}
              onMouseMove={handleMouseMove}
            />
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar with Track Heatmap & Quick Race Engineer trigger */}
          {comparisonData.length > 0 && (
            <div className="comparator-sidebar-col">
              {/* Track Map */}
              <div className="glass-panel" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={15} color="var(--accent-primary)" /> Track Heatmap
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {selectedSessionAObj && (
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <TrackFlag track={selectedSessionAObj.track_name} width={14} height={10} />
                        <span>{selectedSessionAObj.track_name}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      className="nav-tab active"
                      onClick={() => openChat()}
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '12px',
                        background: 'rgba(0, 242, 254, 0.12)',
                        borderColor: 'rgba(0, 242, 254, 0.35)',
                        color: '#00f2fe',
                      }}
                      title="Open AI Race Engineer telemetry analysis"
                    >
                      <Sparkles size={12} color="#00f2fe" /> Ask AI
                    </button>
                  </div>
                </div>

                <ComparatorTrackMap
                  data={comparisonData}
                  activeDistance={hoverDistance}
                  height={380}
                  sector1Distance={sector1Distance}
                  sector2Distance={sector2Distance}
                  onSelectDistance={(dist) => setHoverDistance(dist)}
                />

                {/* Turn Quick-Jump Ribbon */}
                {detectedTurns.length > 0 && (
                  <div style={{ marginTop: '0.45rem', marginBottom: '0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Turns (click to jump):</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{detectedTurns.length} turns</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '4px',
                        overflowX: 'auto',
                        paddingBottom: '3px',
                        scrollbarWidth: 'thin',
                      }}
                    >
                      {detectedTurns.map((turn) => {
                        const isSelected = hoverDistance !== null && Math.abs(turn.distance - hoverDistance) <= 35;
                        return (
                          <button
                            key={turn.name}
                            type="button"
                            onClick={() => setHoverDistance(turn.distance)}
                            style={{
                              background: isSelected ? '#ffd200' : 'rgba(255, 255, 255, 0.08)',
                              color: isSelected ? '#000000' : '#ffffff',
                              border: isSelected ? '1px solid #ffd200' : '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                            title={`${turn.name} (${turn.distance}m)`}
                          >
                            {turn.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Hover Point Live Telemetry Readout */}
                {comparisonData.length > 0 && (() => {
                  const activePoint = hoverDistance !== null ? comparisonData.reduce((prev, curr) =>
                    Math.abs(curr.lap_distance - hoverDistance) < Math.abs(prev.lap_distance - hoverDistance) ? curr : prev
                  , comparisonData[0]) : null;

                  const turnContext = getTurnContextAtDistance(detectedTurns, hoverDistance);

                  return (
                    <div
                      style={{
                        marginTop: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: '0.75rem',
                        minHeight: '112px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                    >
                      {activePoint ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Distance Point:</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f1c40f' }}>{activePoint.lap_distance}m</span>
                            </div>

                            {turnContext.label && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  background: turnContext.phase === 'apex' ? 'rgba(255, 210, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                  color: turnContext.phase === 'apex' ? '#ffd200' : 'rgba(255, 255, 255, 0.85)',
                                  border: turnContext.phase === 'apex' ? '1px solid rgba(255, 210, 0, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                                  borderRadius: '3px',
                                  padding: '1px 5px',
                                }}
                              >
                                📍 {turnContext.label}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <div style={{ borderLeft: '2px solid #ff4757', paddingLeft: '0.35rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#ff4757', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameA}</div>
                              <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedA ?? '-'} km/h</strong></div>
                              <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleA !== null ? Math.round(activePoint.throttleA * 100) : 0}% / {activePoint.brakeA !== null ? Math.round(activePoint.brakeA * 100) : 0}%</strong></div>
                              <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryA !== null ? activePoint.ersBatteryA.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeA ?? 0] || 'Off'})</strong></div>
                            </div>

                            <div style={{ borderLeft: '2px solid #00d2d3', paddingLeft: '0.35rem' }}>
                              <div style={{ fontSize: '0.7rem', color: '#00d2d3', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameB}</div>
                              <div>Speed: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.speedB ?? '-'} km/h</strong></div>
                              <div>Thr/Brk: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.throttleB !== null ? Math.round(activePoint.throttleB * 100) : 0}% / {activePoint.brakeB !== null ? Math.round(activePoint.brakeB * 100) : 0}%</strong></div>
                              <div>ERS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.ersBatteryB !== null ? activePoint.ersBatteryB.toFixed(0) : '-'}% ({ERS_MODE_NAMES[activePoint.ersDeployModeB ?? 0] || 'Off'})</strong></div>
                            </div>
                          </div>

                          {activePoint.time_delta !== null && (
                            <div style={{ marginTop: '0.25rem', paddingTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontWeight: 700, fontSize: '0.74rem', color: activePoint.time_delta < 0 ? '#ff4757' : activePoint.time_delta > 0 ? '#00d2d3' : '#fff' }}>
                              Δ {activePoint.time_delta > 0 ? '+' : ''}{activePoint.time_delta.toFixed(3)}s
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', padding: '0.3rem 0' }}>
                          <span style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: '2px' }}>
                            🔍 Live Telemetry Inspection
                          </span>
                          Hover over graphs or track to inspect telemetry at that point
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
