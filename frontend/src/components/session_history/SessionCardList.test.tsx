import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { SessionCardList } from './SessionCardList';
import { usePlayerPickerStore } from './player/playerPickerStore';
import { sessionKind } from './sessionKind';
import { makePlayerResult, makeSessionListItem } from '../../test/wireFactories';

const sessions = [
  makeSessionListItem(
    { id: 1, track_name: 'Monza', session_type: 'Race', created_at: '2026-08-10T14:00:00Z', packet_format: 2026 },
    { player: makePlayerResult({ position: 4, classified_cars: 20, positions_gained: 3, best_lap_time_ms: 81_234 }) }
  ),
  makeSessionListItem(
    { id: 2, track_name: 'Suzuka', session_type: 'Qualifying', created_at: '2026-08-11T14:00:00Z', packet_format: 2026 },
    { leader: { car_index: 3, driver_name: 'Oscar Piastri', team_id: 8, race_number: 81 } }
  ),
  makeSessionListItem({ id: 3, track_name: 'Spa', session_type: 'Race', packet_format: 2025 }),
];

const renderList = (overrides: Partial<React.ComponentProps<typeof SessionCardList>> = {}) => {
  const props: React.ComponentProps<typeof SessionCardList> = {
    sessions,
    selectedSessionIds: new Set([2]),
    onToggleSelectSession: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onSelectSession: vi.fn(),
    onRequestDelete: vi.fn(),
    onExportSession: vi.fn(),
    formatDate: (date?: string) => date ?? '',
    sortField: 'date',
    sortOrder: 'desc',
    onToggleSort: vi.fn(),
    onOpenTagManager: vi.fn(),
    ...overrides,
  };
  render(<SessionCardList {...props} />);
  return props;
};

describe('SessionCardList', () => {
  it('shows one card per session, named by its track, with its type and selection', () => {
    renderList();
    const list = screen.getByRole('list', { name: 'Recorded sessions' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByRole('heading', { name: 'Monza' })).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute('data-kind', 'race');
    expect(cards[1]).toHaveAttribute('data-kind', 'qualifying');
    expect(cards[1]).toHaveAttribute('data-selected');
    expect(within(cards[1]).getByRole('checkbox')).toBeChecked();
  });

  it('shows your result, or who won when your car is unknown', () => {
    renderList();
    const [monza, suzuka] = screen.getAllByRole('listitem');
    expect(within(monza).getByText('P4')).toBeInTheDocument();
    expect(within(monza).getByText('/20')).toBeInTheDocument();
    expect(within(monza).getByText('▲3')).toBeInTheDocument();
    expect(within(monza).getByText('3 places gained')).toHaveClass('sr-only');
    expect(within(monza).getByText('Best 1:21.234')).toBeInTheDocument();
    fireEvent.click(within(suzuka).getByRole('button', { name: /^Pick your driver in Suzuka/ }));
    expect(usePlayerPickerStore.getState().session?.track_name).toBe('Suzuka');
    act(() => usePlayerPickerStore.getState().closePlayerPicker());
    expect(within(suzuka).getByText('Pole: Oscar Piastri')).toBeInTheDocument();
  });

  it('shows the game format only on sessions that differ from the rest', () => {
    renderList();
    const [monza, suzuka, spa] = screen.getAllByRole('listitem');
    expect(within(monza).queryByText('F1 2026')).not.toBeInTheDocument();
    expect(within(suzuka).queryByText('F1 2026')).not.toBeInTheDocument();
    expect(within(spa).getByText('F1 2025')).toBeInTheDocument();
  });

  it("runs a card's actions for its session", () => {
    const props = renderList();
    const monza = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(monza).getByRole('button', { name: 'Explore: Monza' }));
    expect(props.onSelectSession).toHaveBeenCalledWith(sessions[0]);
    fireEvent.click(within(monza).getByRole('button', { name: 'More actions for Monza, session #1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete session' }));
    expect(props.onRequestDelete).toHaveBeenCalledWith(sessions[0]);
    fireEvent.click(within(monza).getByRole('checkbox'));
    expect(props.onToggleSelectSession).toHaveBeenCalledWith(1);
  });

  it('sorts by another field or reverses the order', () => {
    const props = renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'track' } });
    expect(props.onToggleSort).toHaveBeenCalledWith('track');
    fireEvent.click(screen.getByRole('button', { name: 'Reverse order' }));
    expect(props.onToggleSort).toHaveBeenLastCalledWith('date');
  });

  it('names the kind of session from its type', () => {
    expect(sessionKind('Short Qualifying')).toBe('qualifying');
    expect(sessionKind('Sprint Shootout')).toBe('sprint');
    expect(sessionKind('Practice 2')).toBe('practice');
    expect(sessionKind('Time Trial')).toBeUndefined();
  });
});
