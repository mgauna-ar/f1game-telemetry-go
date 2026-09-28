import { describe, expect, it } from 'vitest';
import { makePlayerResult, makeSessionListItem } from '../test/wireFactories';
import { groupSessions, isSameFilter, matchQuickFilter, normalizeSavedFilters, pageGroups } from './sessionListView';

const tag = (id: number, name: string) => ({ id, name, color: '#fff', created_at: '2026-01-01T00:00:00Z' });

describe('matchQuickFilter', () => {
  const now = Date.UTC(2026, 8, 27, 12);
  it('reads recent sessions and your result', () => {
    const fresh = makeSessionListItem({ created_at: new Date(now - 2 * 86400000).toISOString() });
    const old = makeSessionListItem({ created_at: new Date(now - 9 * 86400000).toISOString() });
    expect(matchQuickFilter(fresh, 'recent', now)).toBe(true);
    expect(matchQuickFilter(old, 'recent', now)).toBe(false);
    expect(matchQuickFilter(fresh, 'yours', now)).toBe(false);

    const p3 = makeSessionListItem({}, { player: makePlayerResult({ position: 3, positions_gained: 2 }) });
    const p3Dnf = makeSessionListItem({}, { player: makePlayerResult({ position: 3, is_dnf: true }) });
    const p4 = makeSessionListItem({}, { player: makePlayerResult({ position: 4, positions_gained: null }) });
    expect(matchQuickFilter(p3, 'podium', now)).toBe(true);
    expect(matchQuickFilter(p3Dnf, 'podium', now)).toBe(false);
    expect(matchQuickFilter(p4, 'podium', now)).toBe(false);
    expect(matchQuickFilter(p3, 'gained', now)).toBe(true);
    expect(matchQuickFilter(p4, 'gained', now)).toBe(false);
  });
});

describe('groupSessions', () => {
  const sessions = [
    makeSessionListItem({
      id: 1,
      track_name: 'Spa',
      created_at: '2026-09-27T20:00:00',
      tags: [tag(2, 'League'), tag(1, 'Setup')],
    }),
    makeSessionListItem({ id: 2, track_name: 'Monza', created_at: '2026-09-27T10:00:00' }),
    makeSessionListItem({ id: 3, track_name: 'Spa', created_at: '2026-09-20T10:00:00', tags: [tag(2, 'League')] }),
  ];

  it('groups by day, newest first unless the list runs oldest first, keeping the list order inside', () => {
    const days = groupSessions(sessions, 'date');
    expect(days.map((g) => [g.key, g.sessions.map((s) => s.id)])).toEqual([
      ['2026-09-27', [1, 2]],
      ['2026-09-20', [3]],
    ]);
    expect(groupSessions(sessions, 'date', { oldestFirst: true })[0].key).toBe('2026-09-20');
  });

  it('groups by track alphabetically, and by tag with a session under each of its tags and untagged last', () => {
    expect(groupSessions(sessions, 'track').map((g) => [g.key, g.sessions.map((s) => s.id)])).toEqual([
      ['track:Monza', [2]],
      ['track:Spa', [1, 3]],
    ]);
    expect(groupSessions(sessions, 'tag').map((g) => [g.key, g.sessions.map((s) => s.id)])).toEqual([
      ['tag:2', [1, 3]],
      ['tag:1', [1]],
      ['tag:none', [2]],
    ]);
    expect(groupSessions(sessions, 'none')).toHaveLength(1);
  });

  it('pages across groups, dropping the groups past the page', () => {
    const paged = pageGroups(groupSessions(sessions, 'tag'), 3);
    expect(paged.total).toBe(4);
    expect(paged.groups.map((g) => g.sessions.map((s) => s.id))).toEqual([[1, 3], [1]]);
  });
});

describe('saved filters', () => {
  it('keeps only well-formed saved filters from storage', () => {
    expect(normalizeSavedFilters('nope')).toEqual([]);
    expect(
      normalizeSavedFilters([
        { id: 'a', name: 'Monza races', circuit: 'Monza', type: 'Race', quick: ['podium', 'bogus'] },
        { id: 'b', name: '  ' },
        { name: 'no id' },
        null,
      ])
    ).toEqual([
      { id: 'a', name: 'Monza races', search: '', type: 'Race', circuit: 'Monza', tagId: null, quick: ['podium'] },
    ]);
  });

  it('compares filter sets regardless of quick filter order and search padding', () => {
    const base = { search: 'spa', type: 'ALL', circuit: 'ALL', tagId: null, quick: ['recent', 'podium'] as const };
    expect(
      isSameFilter({ ...base, quick: [...base.quick] }, { ...base, search: ' spa ', quick: ['podium', 'recent'] })
    ).toBe(true);
    expect(isSameFilter({ ...base, quick: [...base.quick] }, { ...base, quick: ['podium'] })).toBe(false);
  });
});
