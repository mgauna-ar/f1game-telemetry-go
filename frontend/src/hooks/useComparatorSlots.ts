import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';

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

  // Quick Select Leaderboard State
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState<boolean>(() => {
    return storage.get<boolean>('f1_comparator_quick_select_open', true);
  });

  const [driverSearchQuery, setDriverSearchQuery] = useState<string>('');
  const [quickSelectSessionTab, setQuickSelectSessionTab] = useState<'ALL' | 'A' | 'B'>('ALL');

  useEffect(() => {
    storage.set('f1_comparator_quick_select_open', isQuickSelectOpen);
  }, [isQuickSelectOpen]);

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
