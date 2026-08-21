import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Session, Tag } from '../types/session';

export interface UseSessionTagsOptions {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  selectedSession: Session | null;
  setSelectedSession: React.Dispatch<React.SetStateAction<Session | null>>;
}

export interface UseSessionTagsReturn {
  availableTags: Tag[];
  setAvailableTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  selectedTagId: number | null;
  setSelectedTagId: React.Dispatch<React.SetStateAction<number | null>>;
  sessionToManageTags: Session | null;
  setSessionToManageTags: React.Dispatch<React.SetStateAction<Session | null>>;
  fetchTags: () => Promise<void>;
  handleAddTag: (sessionId: number, tagId?: number, newTag?: { name: string; color: string }) => Promise<void>;
  handleRemoveTag: (sessionId: number, tagId: number) => Promise<void>;
  handleDeleteGlobalTag: (tagId: number) => Promise<void>;
  sessionCountByTag: Record<number, number>;
}

export function useSessionTags({
  sessions,
  setSessions,
  selectedSession,
  setSelectedSession,
}: UseSessionTagsOptions): UseSessionTagsReturn {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [sessionToManageTags, setSessionToManageTags] = useState<Session | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.ok) {
        const data: Tag[] = await res.json();
        setAvailableTags(data || []);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  }, []);

  const handleAddTag = useCallback(
    async (sessionId: number, tagId?: number, newTag?: { name: string; color: string }) => {
      try {
        const payload = tagId ? { tag_id: tagId } : newTag;
        const res = await fetch(`/api/sessions/${sessionId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to add tag');
        const updatedTags: Tag[] = await res.json();

        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
        );
        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
        if (sessionToManageTags && sessionToManageTags.id === sessionId) {
          setSessionToManageTags((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
        await fetchTags();
      } catch (err: any) {
        console.error('Error adding tag:', err);
      }
    },
    [selectedSession, sessionToManageTags, setSessions, setSelectedSession, fetchTags]
  );

  const handleRemoveTag = useCallback(
    async (sessionId: number, tagId: number) => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/tags/${tagId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove tag');
        const updatedTags: Tag[] = await res.json();

        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
        );
        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
        if (sessionToManageTags && sessionToManageTags.id === sessionId) {
          setSessionToManageTags((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
      } catch (err: any) {
        console.error('Error removing tag:', err);
      }
    },
    [selectedSession, sessionToManageTags, setSessions, setSelectedSession]
  );

  const handleDeleteGlobalTag = useCallback(
    async (tagId: number) => {
      try {
        const res = await fetch(`/api/tags/${tagId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete tag');

        setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
        setSessions((prev) =>
          prev.map((s) => ({
            ...s,
            tags: (s.tags || []).filter((t) => t.id !== tagId),
          }))
        );
        if (selectedSession) {
          setSelectedSession((prev) =>
            prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.id !== tagId) } : null
          );
        }
        if (sessionToManageTags) {
          setSessionToManageTags((prev) =>
            prev ? { ...prev, tags: (prev.tags || []).filter((t) => t.id !== tagId) } : null
          );
        }
        if (selectedTagId === tagId) {
          setSelectedTagId(null);
        }
      } catch (err: any) {
        console.error('Error deleting tag:', err);
      }
    },
    [selectedSession, sessionToManageTags, selectedTagId, setSessions, setSelectedSession]
  );

  // Session count per tag for filter badges
  const sessionCountByTag = useMemo(() => {
    const counts: Record<number, number> = {};
    sessions.forEach((s) => {
      (s.tags || []).forEach((t) => {
        counts[t.id] = (counts[t.id] || 0) + 1;
      });
    });
    return counts;
  }, [sessions]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    availableTags,
    setAvailableTags,
    selectedTagId,
    setSelectedTagId,
    sessionToManageTags,
    setSessionToManageTags,
    fetchTags,
    handleAddTag,
    handleRemoveTag,
    handleDeleteGlobalTag,
    sessionCountByTag,
  };
}
