import { useState } from 'react';

interface UseComparatorSlotsProps {
  sessionAId: number | '';
  setSessionAId: (id: number | '') => void;
  sessionBId: number | '';
  setSessionBId: (id: number | '') => void;
  lapAId: number | '';
  setLapAId: (id: number | '') => void;
  lapBId: number | '';
  setLapBId: (id: number | '') => void;
  isLinkedSessions: boolean;
}

export interface UseComparatorSlotsReturn {
  isQuickSelectOpen: boolean;
  setIsQuickSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  driverSearchQuery: string;
  setDriverSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  quickSelectSessionTab: 'ALL' | 'A' | 'B';
  setQuickSelectSessionTab: React.Dispatch<React.SetStateAction<'ALL' | 'A' | 'B'>>;
  handleSwapSlots: () => void;
  handleClearSelections: () => void;
}

export function useComparatorSlots({
  sessionAId,
  setSessionAId,
  sessionBId,
  setSessionBId,
  lapAId,
  setLapAId,
  lapBId,
  setLapBId,
  isLinkedSessions,
}: UseComparatorSlotsProps): UseComparatorSlotsReturn {
  // The timing tower is where laps get picked: open while a lap is missing, and folded away once
  // both laps are picked (only then, so changing one lap from the open tower leaves it open).
  const bothLapsPicked = lapAId !== '' && lapBId !== '';
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState<boolean>(!bothLapsPicked);
  const [wereBothLapsPicked, setWereBothLapsPicked] = useState(bothLapsPicked);
  if (bothLapsPicked !== wereBothLapsPicked) {
    setWereBothLapsPicked(bothLapsPicked);
    setIsQuickSelectOpen(!bothLapsPicked);
  }

  const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
  const [quickSelectSessionTab, setQuickSelectSessionTab] = useState<'ALL' | 'A' | 'B'>('ALL');

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

  return {
    isQuickSelectOpen,
    setIsQuickSelectOpen,
    driverSearchQuery,
    setDriverSearchQuery,
    quickSelectSessionTab,
    setQuickSelectSessionTab,
    handleSwapSlots,
    handleClearSelections,
  };
}
