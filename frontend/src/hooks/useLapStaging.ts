import { useState, useCallback } from 'react';
import type { Session, Lap, DriverStanding, StagedLap, NavigationComparatorPayload } from '../types/session';

export interface UseLapStagingOptions {
  onNavigateToComparator?: (payload: NavigationComparatorPayload | number, lapId?: number, slot?: 'A' | 'B') => void;
}

export interface UseLapStagingReturn {
  stagedSlotA: StagedLap | null;
  setStagedSlotA: React.Dispatch<React.SetStateAction<StagedLap | null>>;
  stagedSlotB: StagedLap | null;
  setStagedSlotB: React.Dispatch<React.SetStateAction<StagedLap | null>>;
  handleStageLap: (selectedSession: Session | null, lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => void;
  handleSwapStagedSlots: () => void;
  handleClearStagedA: () => void;
  handleClearStagedB: () => void;
  handleClearAllStaged: () => void;
  handleLaunchComparison: () => void;
}

export function useLapStaging({ onNavigateToComparator }: UseLapStagingOptions = {}): UseLapStagingReturn {
  const [stagedSlotA, setStagedSlotA] = useState<StagedLap | null>(null);
  const [stagedSlotB, setStagedSlotB] = useState<StagedLap | null>(null);

  const handleStageLap = useCallback(
    (selectedSession: Session | null, lap: Lap, driver: DriverStanding, slot: 'A' | 'B') => {
      if (!selectedSession) return;
      const staged: StagedLap = {
        sessionId: selectedSession.id,
        sessionName: selectedSession.track_name,
        lapId: lap.id,
        lapNumber: lap.lap_number,
        lapTimeMS: lap.lap_time_ms,
        driverName: driver.participant.name,
        teamId: driver.participant.team_id,
        raceNumber: driver.participant.race_number,
        tyreCompound: lap.tyre_compound,
      };

      if (slot === 'A') {
        setStagedSlotA((prev) => (prev?.lapId === lap.id ? null : staged));
      } else {
        setStagedSlotB((prev) => (prev?.lapId === lap.id ? null : staged));
      }
    },
    []
  );

  const handleSwapStagedSlots = useCallback(() => {
    setStagedSlotA((prevA) => {
      setStagedSlotB(prevA);
      return stagedSlotB;
    });
  }, [stagedSlotB]);

  const handleClearStagedA = useCallback(() => setStagedSlotA(null), []);
  const handleClearStagedB = useCallback(() => setStagedSlotB(null), []);
  const handleClearAllStaged = useCallback(() => {
    setStagedSlotA(null);
    setStagedSlotB(null);
  }, []);

  const handleLaunchComparison = useCallback(() => {
    if (!stagedSlotA && !stagedSlotB) return;
    if (onNavigateToComparator) {
      onNavigateToComparator({
        sessionAId: stagedSlotA ? stagedSlotA.sessionId : undefined,
        lapAId: stagedSlotA ? stagedSlotA.lapId : undefined,
        sessionBId: stagedSlotB ? stagedSlotB.sessionId : undefined,
        lapBId: stagedSlotB ? stagedSlotB.lapId : undefined,
        sessionId: stagedSlotA ? stagedSlotA.sessionId : stagedSlotB?.sessionId,
        lapId: stagedSlotA ? stagedSlotA.lapId : stagedSlotB?.lapId,
        slot: stagedSlotA ? 'A' : 'B',
      });
    }
  }, [stagedSlotA, stagedSlotB, onNavigateToComparator]);

  return {
    stagedSlotA,
    setStagedSlotA,
    stagedSlotB,
    setStagedSlotB,
    handleStageLap,
    handleSwapStagedSlots,
    handleClearStagedA,
    handleClearStagedB,
    handleClearAllStaged,
    handleLaunchComparison,
  };
}
