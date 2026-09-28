import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRaceEngineerActions } from '../context/RaceEngineerContext';
import { navigate, useRoute } from '../router/router';
import { buildPath, type CompareParams } from '../router/routes';
import { useI18n } from '../context/I18nContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

import { ComparatorDuelHeader } from './lap_comparator/ComparatorDuelHeader';
import { ComparatorTimingTower } from './lap_comparator/ComparatorTimingTower';
import { ComparatorMetricsSummary } from './lap_comparator/ComparatorMetricsSummary';
import { ComparatorTelemetryCharts } from './lap_comparator/ComparatorTelemetryCharts';
import { ComparatorSidebar } from './lap_comparator/ComparatorSidebar';
import { ComparatorQuickStart } from './lap_comparator/ComparatorQuickStart';
import { CornerTable } from './lap_comparator/CornerTable';
import { analyzeCorners, type CornerAnalysis } from '../utils/trackTurns';

import { useComparatorSessions } from '../hooks/useComparatorSessions';
import { useSlotTelemetry } from '../hooks/useSlotTelemetry';
import { useSessionListStore } from '../store/useSessionListStore';
import { useMergedTelemetry } from '../hooks/useMergedTelemetry';
import { useComparatorSlots } from '../hooks/useComparatorSlots';
import type { ComparatorPreferences } from '../types/comparatorPreferences';
import {
  loadComparatorPreferences,
  resolveReferenceLap,
  resolveComparisonLap,
} from '../utils/comparatorPreferencesUtils';
import styles from './LapComparator.module.css';

/**
 * Two laps side by side. The sessions, laps and zoom start from the URL
 * (`/compare?sa=&a=&sb=&b=&zoom=`) and are written back to it as they change, so the page can be
 * reloaded or shared, and the AI chat reads what it is about from there.
 */
export const LapComparator: React.FC = () => {
  const { openChat } = useRaceEngineerActions();
  const route = useRoute();
  const [initial] = useState<CompareParams>(() => (route.page === 'compare' ? route : {}));

  // Hook 1: Session selection & Synchronization link
  const {
    sessions,
    sessionAId,
    setSessionAId,
    sessionBId,
    setSessionBId,
    isLinkedSessions,
    setIsLinkedSessions,
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
  } = useComparatorSessions({ initial });

  // The laps a slot picks once its session loads: from the URL, then from a quick-start card
  const [preload, setPreload] = useState<Pick<CompareParams, 'lapA' | 'lapB'>>({
    lapA: initial.lapA,
    lapB: initial.lapB,
  });

  // Comparator Preferences State
  const [preferences, setPreferences] = useState<ComparatorPreferences>(() => loadComparatorPreferences());

  // The default laps depend on which car was yours in each session, which the session list says:
  // the slots load once it has arrived (or failed), and it stays that way while it refreshes.
  const sessionListSettled = useSessionListStore((s) => s.lastFetchedAt !== null || s.error !== null);
  const [sessionListReady, setSessionListReady] = useState(sessionListSettled);
  useEffect(() => {
    if (sessionListSettled) setSessionListReady(true);
  }, [sessionListSettled]);

  // Hook 2: Slot A telemetry & laps loader
  const slotA = useSlotTelemetry({
    sessionId: sessionListReady ? sessionAId : '',
    preloadLapId: preload.lapA,
    defaultDriverName: 'Reference',
    preferredDriverName: preferences.defaultDriverName,
    playerCarIndex: selectedSessionAObj?.player_car_index ?? null,
  });

  // Hook 2 (reused): Slot B telemetry & laps loader
  const slotB = useSlotTelemetry({
    sessionId: sessionListReady ? sessionBId : '',
    preloadLapId: preload.lapB,
    isSlotB: true,
    isSameSessionAsSlotA: sessionAId === sessionBId,
    defaultDriverName: 'Comparison',
    preferredDriverName: preferences.defaultDriverName,
    playerCarIndex: selectedSessionBObj?.player_car_index ?? null,
    referenceDriver: slotA.driver,
    referenceLapId: slotA.lapId,
    rivalMode: preferences.rivalMode,
    rivalDriverName: preferences.rivalDriverName,
  });

  const handlePreferencesSave = useCallback(
    (newPrefs: ComparatorPreferences) => {
      if (newPrefs.defaultDriverName !== preferences.defaultDriverName) {
        // The session list finds you in older sessions by this name
        useSessionListStore.getState().fetchSessions({ force: true });
      }
      setPreferences(newPrefs);
      if (slotA.participants.length > 0 && slotA.laps.length > 0) {
        const refRes = resolveReferenceLap(
          slotA.participants,
          slotA.laps,
          newPrefs.defaultDriverName,
          selectedSessionAObj?.player_car_index ?? null
        );
        if (refRes.lapId !== '') {
          slotA.setLapId(refRes.lapId);
        }
        const effectiveParticipantsB =
          isLinkedSessions || sessionAId === sessionBId ? slotA.participants : slotB.participants;
        const effectiveLapsB = isLinkedSessions || sessionAId === sessionBId ? slotA.laps : slotB.laps;

        if (effectiveLapsB.length > 0) {
          const compRes = resolveComparisonLap(
            effectiveParticipantsB,
            effectiveLapsB,
            refRes.driver,
            newPrefs.rivalMode,
            newPrefs.rivalDriverName,
            refRes.lapId
          );
          if (compRes.lapId !== '') {
            slotB.setLapId(compRes.lapId);
          }
        }
      }
    },
    [slotA, slotB, isLinkedSessions, sessionAId, sessionBId, preferences.defaultDriverName, selectedSessionAObj]
  );

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
    initialZoom: initial.zoom,
  });

  // Aliases for clear JSX consumption
  const lapAObj = slotA.selectedLap;
  const lapBObj = slotB.selectedLap;
  const driverA = slotA.driver;
  const driverB = slotB.driver;
  const nameA = slotA.driverName;
  const nameB = slotB.driverName;

  const { t } = useI18n();
  useDocumentTitle(lapAObj && lapBObj ? `${nameA} vs ${nameB}` : t('nav.tabs.comparator'));
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

  // Write the comparison into the URL once the laps asked for in it have loaded, so a half-loaded
  // page never drops them. The AI chat reads its target from there.
  const slotSettled = (sessionId: number | '', loadedSessionId: number | '') =>
    sessionId === '' || loadedSessionId === sessionId;
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && slotSettled(sessionAId, slotA.loadedSessionId) && slotSettled(sessionBId, slotB.loadedSessionId)) {
    setHydrated(true);
  }
  const compareUrl = buildPath({
    page: 'compare',
    sessionA: sessionAId || undefined,
    lapA: lapAId || undefined,
    sessionB: sessionBId || undefined,
    lapB: lapBId || undefined,
    zoom: zoomDomain ?? undefined,
  });
  useEffect(() => {
    if (hydrated) navigate(compareUrl, { replace: true });
  }, [hydrated, compareUrl]);

  // "Where did I lose time": one row per detected turn
  const corners = useMemo(() => analyzeCorners(comparisonData, detectedTurns), [comparisonData, detectedTurns]);

  const handleZoomCorner = useCallback(
    (corner: CornerAnalysis) => {
      setZoomDomain(corner.range);
      setHoverDistance(corner.turn.distance);
    },
    [setZoomDomain, setHoverDistance]
  );

  // The chat reads its zoom from the URL, so write the corner's range there before asking
  const handleAskAiCorner = useCallback(
    (corner: CornerAnalysis) => {
      setZoomDomain(corner.range);
      navigate(
        buildPath({
          page: 'compare',
          sessionA: sessionAId || undefined,
          lapA: lapAId || undefined,
          sessionB: sessionBId || undefined,
          lapB: lapBId || undefined,
          zoom: corner.range,
        }),
        { replace: true }
      );
      openChat(
        t('comparator.corners.askAiPrompt', { turn: corner.turn.name, from: corner.range[0], to: corner.range[1] })
      );
    },
    [setZoomDomain, sessionAId, lapAId, sessionBId, lapBId, openChat, t]
  );

  // A quick-start card: load its sessions and laps as if they came from the URL
  const startComparison = useCallback(
    (params: CompareParams) => {
      const sa = params.sessionA;
      if (sa === undefined) return;
      const sb = params.sessionB ?? sa;
      setPreload({ lapA: params.lapA, lapB: params.lapB });
      setZoomDomain(null);
      setIsLinkedSessions(sb === sa);
      setSessionAId(sa);
      setSessionBId(sb);
      // A session that is already loaded won't load again, so pick its laps here
      if (sa === slotA.loadedSessionId && params.lapA) setLapAId(params.lapA);
      if (sb === slotB.loadedSessionId) {
        if (params.lapB) {
          setLapBId(params.lapB);
        } else if (sb === sa && params.lapA) {
          const reference = slotA.laps.find((l) => l.id === params.lapA);
          const next = resolveComparisonLap(
            slotA.participants,
            slotA.laps,
            slotA.participants.find((p) => p.car_index === reference?.car_index),
            preferences.rivalMode,
            preferences.rivalDriverName,
            params.lapA
          );
          if (next.lapId !== '') setLapBId(next.lapId);
        }
      }
    },
    [
      setZoomDomain,
      setIsLinkedSessions,
      setSessionAId,
      setSessionBId,
      slotA.loadedSessionId,
      slotA.laps,
      slotA.participants,
      slotB.loadedSessionId,
      setLapAId,
      setLapBId,
      preferences.rivalMode,
      preferences.rivalDriverName,
    ]
  );
  const showQuickStart = sessionListReady && (sessionAId === '' || (lapAId === '' && lapBId === ''));

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

    let candidateList: Array<(typeof driversA)[0] | (typeof driversB)[0]>;
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
    <div className={styles.page}>
      {/* Header Controls & Comparison Duel Panel */}
      <ComparatorDuelHeader
        sessions={sessions}
        selectedSessionAObj={selectedSessionAObj}
        selectedSessionBObj={selectedSessionBObj}
        isLinkedSessions={isLinkedSessions}
        toggleSessionLink={toggleSessionLink}
        lapAObj={lapAObj}
        lapBObj={lapBObj}
        totalDeltaMs={totalDeltaMs}
        handleSwapSlots={handleSwapSlots}
        isTimingTowerOpen={isQuickSelectOpen}
        setIsTimingTowerOpen={setIsQuickSelectOpen}
        timingTowerTotalCount={quickSelectData.totalCount}
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
        onPreferencesSave={handlePreferencesSave}
      />

      {showQuickStart && !loadingA && !loadingB && (
        <ComparatorQuickStart sessions={sessions} onStart={startComparison} />
      )}

      {/* Enhanced F1 Broadcast Timing Tower & Rival Leaderboard */}
      {sessionAId !== '' && (activeParticipantsA.length > 0 || activeParticipantsB.length > 0) && (
        <ComparatorTimingTower
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
          slotADriver={driverA}
          slotBDriver={driverB}
          lapAObj={lapAObj}
          lapBObj={lapBObj}
        />
      )}

      {/* 2-COLUMN MAIN COMPARISON LAYOUT */}
      {sessionAId !== '' && (lapAObj || lapBObj) && (
        <div className={styles.layout}>
          {/* LEFT COLUMN: Summary cards & Telemetry Charts Stack */}
          <div className={styles.charts}>
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

            {corners.length > 0 && lapAObj && lapBObj && (
              <CornerTable
                corners={corners}
                nameA={nameA}
                nameB={nameB}
                zoomDomain={zoomDomain}
                onZoom={handleZoomCorner}
                onAskAi={handleAskAiCorner}
              />
            )}

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
              zoomDomain={zoomDomain}
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
