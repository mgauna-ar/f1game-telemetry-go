import { useState, useEffect } from 'react';

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
}: UseComparatorSlotsProps) {
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
