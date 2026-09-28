import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionHistory } from '../SessionHistory';
import { useSessionListStore } from '../../store/useSessionListStore';
import type { SessionListItem } from '../../types/session';
import { makePlayerResult, makeSessionListItem } from '../../test/wireFactories';

const mockList = (sessions: SessionListItem[]) => {
  globalThis.fetch = vi.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url.split('?')[0] === '/api/sessions' ? sessions : []),
    })
  );
};

const today = new Date().toISOString();

const SESSIONS = [
  makeSessionListItem(
    { id: 1, track_name: 'Monza', session_type: 'Race', created_at: today },
    { player: makePlayerResult({ position: 2, positions_gained: 3 }) }
  ),
  makeSessionListItem(
    { id: 2, track_name: 'Spa', session_type: 'Race', created_at: '2026-01-10T14:00:00Z' },
    { player: makePlayerResult({ position: 7, positions_gained: -1 }) }
  ),
  makeSessionListItem({ id: 3, track_name: 'Monza', session_type: 'Qualifying', created_at: '2026-01-10T12:00:00Z' }),
];

const rowTracks = () =>
  screen
    .queryAllByRole('rowheader')
    .filter((cell) => cell.getAttribute('scope') === 'row')
    // The cell also holds the flag's country name and code
    .map((cell) =>
      cell.textContent
        ?.split(/[A-Z]{3}(?=[A-Z])/)
        .pop()
        ?.trim()
    );

const renderList = async (sessions = SESSIONS) => {
  mockList(sessions);
  render(<SessionHistory />);
  await waitFor(() => expect(screen.getAllByRole('rowheader').length).toBeGreaterThan(0));
};

describe('Session list: quick filters, saved filters, groups and pages', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useSessionListStore.getState().reset();
  });

  it('narrows the list with the quick filters, which add up', async () => {
    await renderList();
    expect(rowTracks()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'With your result' }));
    expect(rowTracks()).toEqual(['Monza', 'Spa']);

    fireEvent.click(screen.getByRole('button', { name: 'Your podiums' }));
    expect(screen.getByRole('button', { name: 'Your podiums' })).toHaveAttribute('aria-pressed', 'true');
    expect(rowTracks()).toEqual(['Monza']);

    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/ }));
    expect(rowTracks()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Your podiums' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(rowTracks()).toEqual(['Monza']);
  });

  it('saves the current filters under a name, applies them with a click and deletes them', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Places gained' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save these filters' }));

    const name = screen.getByRole('textbox', { name: 'Name for these filters' });
    expect(name).toHaveValue('Places gained');
    fireEvent.change(name, { target: { value: 'Comebacks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const saved = screen.getByRole('button', { name: 'Comebacks' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('f1_history_saved_filters') ?? '[]')).toMatchObject([
      { name: 'Comebacks', quick: ['gained'] },
    ]);
    // Nothing to save while the saved filter is the one applied
    expect(screen.queryByRole('button', { name: 'Save these filters' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear Filters/ }));
    expect(rowTracks()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Comebacks' }));
    expect(rowTracks()).toEqual(['Monza']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete saved filter Comebacks' }));
    expect(screen.queryByRole('button', { name: 'Comebacks' })).not.toBeInTheDocument();
    expect(localStorage.getItem('f1_history_saved_filters')).toBe('[]');
  });

  it('groups the list by track, folds a group, and remembers the grouping', async () => {
    await renderList();
    fireEvent.click(screen.getByRole('radio', { name: 'Track' }));
    expect(localStorage.getItem('f1_history_group_by')).toBe('track');

    const headings = screen.getAllByRole('rowheader').filter((cell) => cell.getAttribute('scope') === 'rowgroup');
    expect(headings.map((h) => h.textContent)).toEqual(['ItalyMonza2 sessions', 'BelgiumSpa1 session']);

    fireEvent.click(within(headings[0]).getByRole('button', { name: /Monza/ }));
    expect(within(headings[0]).getByRole('button', { name: /Monza/ })).toHaveAttribute('aria-expanded', 'false');
    expect(rowTracks().filter((t) => t === 'Spa')).toHaveLength(1);
    expect(screen.queryAllByRole('row').filter((row) => /Qualifying/.test(row.textContent ?? ''))).toHaveLength(0);
  });

  it('shows the first 50 sessions and the rest on request', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      makeSessionListItem({
        id: i + 1,
        track_name: `Track ${String(i + 1).padStart(2, '0')}`,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      })
    );
    await renderList(many);
    expect(rowTracks()).toHaveLength(50);
    expect(screen.getByText('Showing 50 of 60 sessions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show 10 more' }));
    expect(rowTracks()).toHaveLength(60);
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});
