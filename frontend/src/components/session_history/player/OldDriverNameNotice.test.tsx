import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import { makeSessionListItem } from '../../../test/wireFactories';
import { api } from '../../../utils/apiClient';
import { OldDriverNameNotice } from './OldDriverNameNotice';

const KEY = 'f1_comparator_default_driver_name';

const renderNotice = () =>
  render(
    <I18nProvider>
      <OldDriverNameNotice />
    </I18nProvider>
  );

const load = (
  sessions = [
    makeSessionListItem({ id: 1, player_car_index: null }),
    makeSessionListItem({ id: 2, player_car_index: 0, player_car_source: 'game' }),
    makeSessionListItem({ id: 3, player_car_index: null }),
  ]
) =>
  act(() => {
    useSessionListStore.setState({ sessions, lastFetchedAt: Date.now() });
  });

describe('OldDriverNameNotice', () => {
  beforeEach(() => {
    useSessionListStore.getState().reset();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows nothing without the old saved name', () => {
    load();
    renderNotice();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('waits for the list, then offers the name for the sessions without a driver', () => {
    localStorage.setItem(KEY, JSON.stringify('Piastri'));
    renderNotice();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    load();
    expect(
      screen.getByRole('region', { name: 'Apply “Piastri” to the 2 sessions without a driver?' })
    ).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it('applies it through the batch action, reports the result and forgets the name', async () => {
    localStorage.setItem(KEY, 'Piastri');
    const post = vi.spyOn(api, 'post').mockResolvedValue({ updated: [1], not_found: [3], ambiguous: [] });
    vi.spyOn(api, 'get').mockResolvedValue([]);
    renderNotice();
    load();

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(screen.queryByRole('region')).not.toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/api/sessions/batch-player', { session_ids: [1, 3], driver_name: 'Piastri' });
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      '“Piastri” applied. Updated: 1 · without that driver: 1'
    );
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('keeps the notice and the name when the batch fails', async () => {
    localStorage.setItem(KEY, 'Piastri');
    vi.spyOn(api, 'post').mockRejectedValue(new Error('offline'));
    renderNotice();
    load();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe("Couldn't save your driver: offline");
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('Piastri');
  });

  it('forgets the name when dismissed', () => {
    localStorage.setItem(KEY, 'Piastri');
    const post = vi.spyOn(api, 'post');
    renderNotice();
    load();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('forgets the name without asking when every session has a driver', () => {
    localStorage.setItem(KEY, 'Piastri');
    renderNotice();
    load([makeSessionListItem({ id: 2, player_car_index: 0, player_car_source: 'game' })]);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
