import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SessionCardList } from './SessionCardList';
import { sessionKind } from './sessionKind';
import { makeSession } from '../../test/wireFactories';

const sessions = [
  makeSession({ id: 1, track_name: 'Monza', session_type: 'Race', created_at: '2026-08-10T14:00:00Z' }),
  makeSession({ id: 2, track_name: 'Suzuka', session_type: 'Qualifying', created_at: '2026-08-11T14:00:00Z' }),
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
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('heading', { name: 'Monza' })).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute('data-kind', 'race');
    expect(cards[1]).toHaveAttribute('data-kind', 'qualifying');
    expect(cards[1]).toHaveAttribute('data-selected');
    expect(within(cards[1]).getByRole('checkbox')).toBeChecked();
  });

  it("runs a card's actions for its session", () => {
    const props = renderList();
    const monza = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(monza).getByRole('button', { name: 'Explore: Monza' }));
    expect(props.onSelectSession).toHaveBeenCalledWith(sessions[0]);
    fireEvent.click(within(monza).getByRole('button', { name: /Delete Session #1/ }));
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
