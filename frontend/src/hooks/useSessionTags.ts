import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Session, Tag } from '../types/session';
import { api } from '../utils/apiClient';
import { useToastStore } from '../store/useToastStore';

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
      const data = await api.get<Tag[]>('/api/tags');
      setAvailableTags(data || []);
    } catch {
      // Ignore tag fetch failures
    }
  }, []);

  const handleAddTag = useCallback(
    async (sessionId: number, tagId?: number, newTag?: { name: string; color: string }) => {
      try {
        const payload = tagId ? { tag_id: tagId } : newTag;
        const updatedTags = await api.post<Tag[]>(`/api/sessions/${sessionId}/tags`, payload);

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
      } catch (err: unknown) {
        useToastStore.getState().showToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to add tag',
        });
      }
    },
    [selectedSession, sessionToManageTags, setSessions, setSelectedSession, fetchTags]
  );

  const handleRemoveTag = useCallback(
    async (sessionId: number, tagId: number) => {
      try {
        const updatedTags = await api.del<Tag[]>(`/api/sessions/${sessionId}/tags/${tagId}`);

        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, tags: updatedTags } : s))
        );
        if (selectedSession && selectedSession.id === sessionId) {
          setSelectedSession((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
        if (sessionToManageTags && sessionToManageTags.id === sessionId) {
          setSessionToManageTags((prev) => (prev ? { ...prev, tags: updatedTags } : null));
        }
      } catch (err: unknown) {
        useToastStore.getState().showToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to remove tag',
        });
      }
    },
    [selectedSession, sessionToManageTags, setSessions, setSelectedSession]
  );

  const handleDeleteGlobalTag = useCallback(
    async (tagId: number) => {
      try {
        await api.del(`/api/tags/${tagId}`);

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
      } catch (err: unknown) {
        useToastStore.getState().showToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to delete tag',
        });
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
