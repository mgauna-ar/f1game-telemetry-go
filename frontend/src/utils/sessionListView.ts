import type { SessionListItem, Tag } from '../types/session';

/** One-click filters on top of the search, type, circuit and tag filters. */
export type QuickFilter = 'recent' | 'yours' | 'podium' | 'gained';

export const QUICK_FILTERS: readonly QuickFilter[] = ['recent', 'yours', 'podium', 'gained'];

/** How far back "recent" reaches. */
export const RECENT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a session passes one quick filter; the player ones need a recorded or name-matched result. */
export function matchQuickFilter(session: SessionListItem, filter: QuickFilter, now = Date.now()): boolean {
  const player = session.summary?.player ?? null;
  switch (filter) {
    case 'recent': {
      const at = new Date(session.created_at).getTime();
      return Number.isFinite(at) && now - at <= RECENT_DAYS * DAY_MS;
    }
    case 'yours':
      return player !== null;
    case 'podium':
      return player !== null && player.position >= 1 && player.position <= 3 && !player.is_dnf && !player.is_dsq;
    case 'gained':
      return (player?.positions_gained ?? 0) > 0;
  }
}

export type SessionGroupBy = 'none' | 'date' | 'track' | 'tag';

export const SESSION_GROUP_BYS: readonly SessionGroupBy[] = ['none', 'date', 'track', 'tag'];

export const isSessionGroupBy = (value: unknown): value is SessionGroupBy =>
  typeof value === 'string' && (SESSION_GROUP_BYS as readonly string[]).includes(value);

/** A run of the list under one heading. `none` is the whole list, with no heading. */
export type SessionGroup =
  | { kind: 'none'; key: string; sessions: SessionListItem[] }
  | { kind: 'date'; key: string; date: Date; sessions: SessionListItem[] }
  | { kind: 'track'; key: string; track: string; sessions: SessionListItem[] }
  | { kind: 'tag'; key: string; tag: Tag | null; sessions: SessionListItem[] };

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Splits an already sorted list into groups, keeping the list's order inside each group. Days run
 * newest first (oldest first when `oldestFirst`, as when the list is sorted by date ascending),
 * tracks and tags alphabetically with untagged sessions last. A session with several tags is
 * listed under each of them.
 */
export function groupSessions(
  sessions: readonly SessionListItem[],
  groupBy: SessionGroupBy,
  { oldestFirst = false }: { oldestFirst?: boolean } = {}
): SessionGroup[] {
  if (groupBy === 'none') return [{ kind: 'none', key: 'all', sessions: [...sessions] }];

  const groups = new Map<string, SessionGroup>();
  const add = (key: string, make: () => SessionGroup, session: SessionListItem) => {
    let group = groups.get(key);
    if (!group) {
      group = make();
      groups.set(key, group);
    }
    group.sessions.push(session);
  };

  for (const session of sessions) {
    if (groupBy === 'date') {
      const date = new Date(session.created_at);
      const valid = Number.isFinite(date.getTime());
      const key = valid ? dayKey(date) : 'unknown';
      add(key, () => ({ kind: 'date', key, date: valid ? date : new Date(0), sessions: [] }), session);
    } else if (groupBy === 'track') {
      const track = session.track_name || '';
      add(`track:${track}`, () => ({ kind: 'track', key: `track:${track}`, track, sessions: [] }), session);
    } else {
      const tags = session.tags?.length ? session.tags : [null];
      for (const tag of tags) {
        const key = tag ? `tag:${tag.id}` : 'tag:none';
        add(key, () => ({ kind: 'tag', key, tag, sessions: [] }), session);
      }
    }
  }

  const list = [...groups.values()];
  if (groupBy === 'date') {
    list.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) * (oldestFirst ? 1 : -1));
  } else if (groupBy === 'track') {
    list.sort((a, b) => (a.kind === 'track' && b.kind === 'track' ? a.track.localeCompare(b.track) : 0));
  } else {
    list.sort((a, b) => {
      if (a.kind !== 'tag' || b.kind !== 'tag') return 0;
      if (!a.tag || !b.tag) return a.tag ? -1 : b.tag ? 1 : 0;
      return a.tag.name.localeCompare(b.tag.name);
    });
  }
  return list;
}

/** The first `limit` rows of the groups, keeping each group's heading while it has rows. */
export function pageGroups(groups: readonly SessionGroup[], limit: number): { groups: SessionGroup[]; total: number } {
  const total = groups.reduce((sum, g) => sum + g.sessions.length, 0);
  const paged: SessionGroup[] = [];
  let left = limit;
  for (const group of groups) {
    if (left <= 0) break;
    const sessions = group.sessions.slice(0, left);
    left -= sessions.length;
    paged.push({ ...group, sessions });
  }
  return { groups: paged, total };
}

/** A filter set saved under a name, applied with one click. */
export interface SavedSessionFilter {
  id: string;
  name: string;
  search: string;
  type: string;
  circuit: string;
  tagId: number | null;
  quick: QuickFilter[];
}

/** Keeps the saved filters that still have the right shape; storage may hold an older or broken value. */
export function normalizeSavedFilters(value: unknown): SavedSessionFilter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): SavedSessionFilter[] => {
    if (!raw || typeof raw !== 'object') return [];
    const f = raw as Record<string, unknown>;
    if (typeof f.id !== 'string' || typeof f.name !== 'string' || !f.name.trim()) return [];
    return [
      {
        id: f.id,
        name: f.name,
        search: typeof f.search === 'string' ? f.search : '',
        type: typeof f.type === 'string' ? f.type : 'ALL',
        circuit: typeof f.circuit === 'string' ? f.circuit : 'ALL',
        tagId: typeof f.tagId === 'number' ? f.tagId : null,
        quick: Array.isArray(f.quick)
          ? f.quick.filter((q): q is QuickFilter => (QUICK_FILTERS as readonly unknown[]).includes(q))
          : [],
      },
    ];
  });
}

/** Whether the saved filter is the one applied now. */
export function isSameFilter(a: Omit<SavedSessionFilter, 'id' | 'name'>, b: Omit<SavedSessionFilter, 'id' | 'name'>) {
  return (
    a.search.trim() === b.search.trim() &&
    a.type === b.type &&
    a.circuit === b.circuit &&
    a.tagId === b.tagId &&
    a.quick.length === b.quick.length &&
    a.quick.every((q) => b.quick.includes(q))
  );
}
