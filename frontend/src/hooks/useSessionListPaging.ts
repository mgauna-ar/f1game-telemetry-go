import { useCallback, useMemo, useState } from 'react';
import type { SessionListItem } from '../types/session';
import { groupSessions, pageGroups, type SessionGroup, type SessionGroupBy } from '../utils/sessionListView';

/** Rows shown at first, and added by each "Show more". */
export const SESSION_PAGE_SIZE = 50;

export interface SessionListPaging {
  /** The groups with rows on the page so far (all of a collapsed group counts as shown). */
  groups: SessionGroup[];
  /** Rows in every group, including any not shown yet. */
  total: number;
  shown: number;
  showMore: () => void;
  isCollapsed: (key: string) => boolean;
  toggleGroup: (key: string) => void;
}

/**
 * Groups the sorted list and pages it: the first `SESSION_PAGE_SIZE` rows, then more on request.
 * The page and the collapsed groups start over when the list or the grouping changes (a new
 * filter or sort), so a filter never leaves the view part way down an old list.
 */
export function useSessionListPaging(
  sessions: readonly SessionListItem[],
  groupBy: SessionGroupBy,
  oldestFirst: boolean
): SessionListPaging {
  const all = useMemo(() => groupSessions(sessions, groupBy, { oldestFirst }), [sessions, groupBy, oldestFirst]);
  const [page, setPage] = useState({ source: all, limit: SESSION_PAGE_SIZE, collapsed: new Set<string>() });
  // Start over on a new list, during render rather than in an effect, so no stale page flashes
  const current = page.source === all ? page : { source: all, limit: SESSION_PAGE_SIZE, collapsed: new Set<string>() };
  if (current !== page) setPage(current);

  // Collapsed groups take no rows from the page
  const visible = useMemo(() => all.filter((g) => !current.collapsed.has(g.key)), [all, current.collapsed]);
  const paged = useMemo(() => pageGroups(visible, current.limit), [visible, current.limit]);
  const groups = useMemo(() => {
    const shownKeys = new Map(paged.groups.map((g) => [g.key, g]));
    const lastShown = paged.groups[paged.groups.length - 1]?.key;
    const out: SessionGroup[] = [];
    for (const g of all) {
      if (current.collapsed.has(g.key)) {
        out.push(g);
        continue;
      }
      const shown = shownKeys.get(g.key);
      if (shown) out.push(shown);
      if (g.key === lastShown && paged.total > current.limit) break;
    }
    return out;
  }, [all, paged, current.collapsed, current.limit]);

  const shown = paged.groups.reduce((sum, g) => sum + g.sessions.length, 0);

  const showMore = useCallback(() => setPage((p) => ({ ...p, limit: p.limit + SESSION_PAGE_SIZE })), []);
  const toggleGroup = useCallback(
    (key: string) =>
      setPage((p) => {
        const collapsed = new Set(p.collapsed);
        if (collapsed.has(key)) collapsed.delete(key);
        else collapsed.add(key);
        return { ...p, collapsed };
      }),
    []
  );
  const isCollapsed = useCallback((key: string) => current.collapsed.has(key), [current.collapsed]);

  return { groups, total: paged.total, shown, showMore, isCollapsed, toggleGroup };
}
