import React, { useEffect, useMemo } from 'react';
import type { NavigationComparatorPayload } from '../types/session';
import { buildTelemetryContext } from '../utils/aiTelemetrySummary';
import { useRaceEngineerActions } from '../context/RaceEngineerContext';

import { ComparatorHeader } from './lap_comparator/ComparatorHeader';
import { QuickSelectLeaderboard } from './lap_comparator/QuickSelectLeaderboard';
import { ComparatorMetricsSummary } from './lap_comparator/ComparatorMetricsSummary';
import { ComparatorTelemetryCharts } from './lap_comparator/ComparatorTelemetryCharts';
import { ComparatorSidebar } from './lap_comparator/ComparatorSidebar';

import { useComparatorSessions } from '../hooks/useComparatorSessions';
import { useSlotTelemetry } from '../hooks/useSlotTelemetry';
import { useMergedTelemetry } from '../hooks/useMergedTelemetry';
import { useComparatorSlots } from '../hooks/useComparatorSlots';

export interface LapComparatorProps {
  initialPreload?: NavigationComparatorPayload | null;
}

export const LapComparator: React.FC<LapComparatorProps> = ({ initialPreload }) => {
  const { setComparatorContext, setContextMode, openChat } = useRaceEngineerActions();

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
    isSessionBDropdownOpen,
    setIsSessionBDropdownOpen,
    sessionBSearchQuery,
    setSessionBSearchQuery,
    sessionBTypeTab,
    setSessionBTypeTab,
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
    loading: isMergedLoading,
  } = useMergedTelemetry({
    lapAId: slotA.lapId,
    lapBId: slotB.lapId,
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
  const loadingA = slotA.loading;
  const loadingB = slotB.loading;
  const activeParticipantsA = slotA.activeParticipants;
  const activeParticipantsB = slotB.activeParticipants;
  const setLapAId = slotA.setLapId;
  const setLapBId = slotB.setLapId;

  // Hook 4: Slot actions & Quick select state
  const {
    isQuickSelectOpen,
    setIsQuickSelectOpen,
    driverSearchQuery,
    setDriverSearchQuery,
    quickSelectSessionTab,
    setQuickSelectSessionTab,
    handleSwapSlots,
    handleClearSelections,
  } = useComparatorSlots({
    sessionAId,
    setSessionAId,
    sessionBId,
    setSessionBId,
    lapAId,
    setLapAId,
    lapBId,
    setLapBId,
    isLinkedSessions,
  });

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
      selectedSessionBObj?.weather,
      detectedTurns
    );
  }, [selectedSessionAObj, selectedSessionBObj, lapAObj, lapBObj, nameA, nameB, comparisonData, zoomDomain, detectedTurns]);

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

  return (
    <div className="dashboard-grid" style={{ paddingTop: 0 }}>
      {/* Header Controls & Comparison Slots Panel */}
      <ComparatorHeader
        sessions={sessions}
        selectedSessionAObj={selectedSessionAObj}
        selectedSessionBObj={selectedSessionBObj}
        isLinkedSessions={isLinkedSessions}
        toggleSessionLink={toggleSessionLink}
        lapAObj={lapAObj}
        lapBObj={lapBObj}
        totalDeltaMs={totalDeltaMs}
        handleSwapSlots={handleSwapSlots}
        isQuickSelectOpen={isQuickSelectOpen}
        setIsQuickSelectOpen={setIsQuickSelectOpen}
        quickSelectTotalCount={quickSelectData.totalCount}
        handleClearSelections={handleClearSelections}
        slotA={slotA}
        slotB={slotB}
        filteredDropdownSessionsA={filteredDropdownSessionsA}
        filteredDropdownSessionsB={filteredDropdownSessionsB}
        isSessionADropdownOpen={isSessionADropdownOpen}
        setIsSessionADropdownOpen={setIsSessionADropdownOpen}
        isSessionBDropdownOpen={isSessionBDropdownOpen}
        setIsSessionBDropdownOpen={setIsSessionBDropdownOpen}
        sessionASearchQuery={sessionASearchQuery}
        setSessionASearchQuery={setSessionASearchQuery}
        sessionBSearchQuery={sessionBSearchQuery}
        setSessionBSearchQuery={setSessionBSearchQuery}
        sessionATypeTab={sessionATypeTab}
        setSessionATypeTab={setSessionATypeTab}
        sessionBTypeTab={sessionBTypeTab}
        setSessionBTypeTab={setSessionBTypeTab}
        handleSelectSessionA={handleSelectSessionA}
        handleSelectSessionB={handleSelectSessionB}
        s1Delta={s1Delta}
        s2Delta={s2Delta}
        s3Delta={s3Delta}
      />

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
              loadingA={isMergedLoading || loadingA}
              loadingB={isMergedLoading || loadingB}
              onMouseMove={handleMouseMove}
            />
          </div>

          {/* RIGHT COLUMN: Sticky Sidebar with Track Heatmap & Quick Race Engineer trigger */}
          {comparisonData.length > 0 && (
            <ComparatorSidebar
              comparisonData={comparisonData}
              detectedTurns={detectedTurns}
              hoverDistance={hoverDistance}
              setHoverDistance={setHoverDistance}
              sector1Distance={sector1Distance}
              sector2Distance={sector2Distance}
              selectedSessionAObj={selectedSessionAObj}
              nameA={nameA}
              nameB={nameB}
              onOpenAiDebrief={() => openChat()}
            />
          )}
        </div>
      )}
    </div>
  );
};
