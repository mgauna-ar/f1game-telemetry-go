import { useState, useCallback } from 'react';
import type { Session, Lap, DriverStanding, StagedLap } from '../types/session';
import { openComparator } from '../router/router';

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

export function useLapStaging(): UseLapStagingReturn {
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
    setStagedSlotA(stagedSlotB);
    setStagedSlotB(stagedSlotA);
  }, [stagedSlotA, stagedSlotB]);

  const handleClearStagedA = useCallback(() => setStagedSlotA(null), []);
  const handleClearStagedB = useCallback(() => setStagedSlotB(null), []);
  const handleClearAllStaged = useCallback(() => {
    setStagedSlotA(null);
    setStagedSlotB(null);
  }, []);

  /** Opens the comparator with the staged laps. */
  const handleLaunchComparison = useCallback(() => {
    if (!stagedSlotA && !stagedSlotB) return;
    openComparator({
      sessionA: stagedSlotA?.sessionId,
      lapA: stagedSlotA?.lapId,
      sessionB: stagedSlotB?.sessionId,
      lapB: stagedSlotB?.lapId,
    });
  }, [stagedSlotA, stagedSlotB]);

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
