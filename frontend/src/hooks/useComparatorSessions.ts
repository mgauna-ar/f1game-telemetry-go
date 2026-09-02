import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Session, NavigationComparatorPayload } from '../types/session';
import { getTrackInfo } from '../constants/f1';
import { useI18n } from '../context/I18nContext';
import { useSessionListStore } from '../store/useSessionListStore';

export interface UseComparatorSessionsOptions {
  initialPreload?: NavigationComparatorPayload | null;
}

export type SessionTypeTab = 'ALL' | 'RACE' | 'SPRINT' | 'QUALI' | 'PRACTICE';

export interface UseComparatorSessionsReturn {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  error: string | null;
  sessionAId: number | '';
  setSessionAId: React.Dispatch<React.SetStateAction<number | ''>>;
  sessionBId: number | '';
  setSessionBId: React.Dispatch<React.SetStateAction<number | ''>>;
  isLinkedSessions: boolean;
  setIsLinkedSessions: React.Dispatch<React.SetStateAction<boolean>>;
  isSessionADropdownOpen: boolean;
  setIsSessionADropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sessionASearchQuery: string;
  setSessionASearchQuery: React.Dispatch<React.SetStateAction<string>>;
  sessionATypeTab: SessionTypeTab;
  setSessionATypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  isSessionBDropdownOpen: boolean;
  setIsSessionBDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sessionBSearchQuery: string;
  setSessionBSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  sessionBTypeTab: SessionTypeTab;
  setSessionBTypeTab: React.Dispatch<React.SetStateAction<SessionTypeTab>>;
  fetchSessions: () => void;
  handleSelectSessionA: (sessionId: number) => void;
  handleSelectSessionB: (sessionId: number) => void;
  toggleSessionLink: () => void;
  selectedSessionAObj: Session | undefined;
  selectedSessionBObj: Session | undefined;
  filteredDropdownSessionsA: Session[];
  filteredDropdownSessionsB: Session[];
}

export function useComparatorSessions({
  initialPreload,
}: UseComparatorSessionsOptions = {}): UseComparatorSessionsReturn {
  const { t } = useI18n();
  const sessions = useSessionListStore((s) => s.sessions);
  const setSessions = useSessionListStore((s) => s.setSessions) as unknown as React.Dispatch<React.SetStateAction<Session[]>>;
  const error = useSessionListStore((s) => s.error);
  const storeFetchSessions = useSessionListStore((s) => s.fetchSessions);

  // Dual session IDs & Synchronization link
  const [sessionAId, setSessionAId] = useState<number | ''>(() => {
    if (initialPreload?.sessionAId) return initialPreload.sessionAId;
    if (initialPreload?.sessionId && (!initialPreload?.slot || initialPreload?.slot === 'A')) return initialPreload.sessionId;
    return '';
  });

  const [sessionBId, setSessionBId] = useState<number | ''>(() => {
    if (initialPreload?.sessionBId) return initialPreload.sessionBId;
    if (initialPreload?.sessionId && initialPreload?.slot === 'B') return initialPreload.sessionId;
    if (initialPreload?.sessionAId) return initialPreload.sessionAId;
    if (initialPreload?.sessionId) return initialPreload.sessionId;
    return '';
  });

  const [isLinkedSessions, setIsLinkedSessions] = useState(true);

  // Dropdown UI states
  const [isSessionADropdownOpen, setIsSessionADropdownOpen] = useState(false);
  const [sessionASearchQuery, setSessionASearchQuery] = useState('');
  const [sessionATypeTab, setSessionATypeTab] = useState<SessionTypeTab>('ALL');

  const [isSessionBDropdownOpen, setIsSessionBDropdownOpen] = useState(false);
  const [sessionBSearchQuery, setSessionBSearchQuery] = useState('');
  const [sessionBTypeTab, setSessionBTypeTab] = useState<SessionTypeTab>('ALL');

  // Fetch available sessions via shared store
  const fetchSessions = useCallback(() => {
    storeFetchSessions();
  }, [storeFetchSessions]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Handle Session A Selection
  const handleSelectSessionA = useCallback(
    (sessionId: number) => {
      setSessionAId(sessionId);
      setIsSessionADropdownOpen(false);
      if (isLinkedSessions) {
        setSessionBId(sessionId);
      } else {
        const newSessionA = sessions.find((s) => s.id === sessionId);
        const currentSessionB = sessions.find((s) => s.id === sessionBId);
        if (
          newSessionA &&
          currentSessionB &&
          newSessionA.track_name.toLowerCase() !== currentSessionB.track_name.toLowerCase()
        ) {
          setSessionBId(sessionId);
        }
      }
    },
    [isLinkedSessions, sessions, sessionBId]
  );

  // Handle Session B Selection
  const handleSelectSessionB = useCallback(
    (sessionId: number) => {
      setSessionBId(sessionId);
      setIsSessionBDropdownOpen(false);
      if (isLinkedSessions && sessionId !== sessionAId) {
        setIsLinkedSessions(false);
      }
    },
    [isLinkedSessions, sessionAId]
  );

  // Toggle Linked Sessions
  const toggleSessionLink = useCallback(() => {
    if (!isLinkedSessions) {
      setIsLinkedSessions(true);
      setSessionBId(sessionAId);
    } else {
      setIsLinkedSessions(false);
    }
  }, [isLinkedSessions, sessionAId]);

  // Selected session objects
  const selectedSessionAObj = useMemo(() => sessions.find((s) => s.id === sessionAId), [sessions, sessionAId]);
  const selectedSessionBObj = useMemo(() => sessions.find((s) => s.id === sessionBId), [sessions, sessionBId]);

  // Filtered Sessions for Dropdown A
  const filteredDropdownSessionsA = useMemo(() => {
    const query = sessionASearchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      const trackInfo = getTrackInfo(s.track_name);
      const localizedCountry = trackInfo ? t(`common.countries.${trackInfo.countryCode}`) : '';
      const countryMatches =
        trackInfo &&
        (trackInfo.countryIso3.toLowerCase().includes(query) ||
          trackInfo.countryCode.toLowerCase().includes(query) ||
          (typeof localizedCountry === 'string' && localizedCountry.toLowerCase().includes(query)) ||
          (trackInfo.aliases && trackInfo.aliases.some((a) => a.toLowerCase().includes(query))));

      const matchesSearch =
        !query ||
        s.track_name.toLowerCase().includes(query) ||
        Boolean(countryMatches) ||
        s.session_type.toLowerCase().includes(query) ||
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(query) ||
        (s.tags && s.tags.some((t) => t.name.toLowerCase().includes(query)));

      if (!matchesSearch) return false;

      if (sessionATypeTab === 'ALL') return true;
      const lower = s.session_type.toLowerCase();
      if (sessionATypeTab === 'SPRINT') return lower.includes('sprint');
      if (sessionATypeTab === 'RACE') return lower.includes('race') && !lower.includes('sprint');
      if (sessionATypeTab === 'QUALI')
        return (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) && !lower.includes('sprint');
      if (sessionATypeTab === 'PRACTICE')
        return lower.includes('practice') || lower.includes('fp') || lower.includes('p1') || lower.includes('p2') || lower.includes('p3');
      return true;
    });
  }, [sessions, sessionASearchQuery, sessionATypeTab, t]);

  // Filtered Sessions for Dropdown B (Strictly restricted to same circuit as Session A)
  const filteredDropdownSessionsB = useMemo(() => {
    const query = sessionBSearchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      if (selectedSessionAObj && s.track_name.toLowerCase() !== selectedSessionAObj.track_name.toLowerCase()) {
        return false;
      }

      const trackInfo = getTrackInfo(s.track_name);
      const localizedCountry = trackInfo ? t(`common.countries.${trackInfo.countryCode}`) : '';
      const countryMatches =
        trackInfo &&
        (trackInfo.countryIso3.toLowerCase().includes(query) ||
          trackInfo.countryCode.toLowerCase().includes(query) ||
          (typeof localizedCountry === 'string' && localizedCountry.toLowerCase().includes(query)) ||
          (trackInfo.aliases && trackInfo.aliases.some((a) => a.toLowerCase().includes(query))));

      const matchesSearch =
        !query ||
        s.track_name.toLowerCase().includes(query) ||
        Boolean(countryMatches) ||
        s.session_type.toLowerCase().includes(query) ||
        new Date(s.created_at).toLocaleDateString().toLowerCase().includes(query) ||
        (s.tags && s.tags.some((t) => t.name.toLowerCase().includes(query)));

      if (!matchesSearch) return false;

      if (sessionBTypeTab === 'ALL') return true;
      const lower = s.session_type.toLowerCase();
      if (sessionBTypeTab === 'SPRINT') return lower.includes('sprint');
      if (sessionBTypeTab === 'RACE') return lower.includes('race') && !lower.includes('sprint');
      if (sessionBTypeTab === 'QUALI')
        return (lower.includes('qual') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) && !lower.includes('sprint');
      if (sessionBTypeTab === 'PRACTICE')
        return lower.includes('practice') || lower.includes('fp') || lower.includes('p1') || lower.includes('p2') || lower.includes('p3');
      return true;
    });
  }, [sessions, selectedSessionAObj, sessionBSearchQuery, sessionBTypeTab, t]);

  return {
    sessions,
    setSessions,
    error,
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
    fetchSessions,
    handleSelectSessionA,
    handleSelectSessionB,
    toggleSessionLink,
    selectedSessionAObj,
    selectedSessionBObj,
    filteredDropdownSessionsA,
    filteredDropdownSessionsB,
  };
}
