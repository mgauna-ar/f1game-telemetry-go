import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import { makeLap, makeParticipant, makeSessionListItem } from '../../../test/wireFactories';
import { api } from '../../../utils/apiClient';
import { invalidateSessionLapData, primeSessionLapData } from '../../../utils/sessionDataCache';
import { BatchDriverModal } from './BatchDriverModal';
import { driverNameSuggestions } from './driverNameSuggestions';

const car = (session: number, index: number, name: string) =>
  makeParticipant({ session_id: session, car_index: index, name, race_number: index + 1, position: index + 1 });
const lapsFor = (session: number, cars: number) =>
  Array.from({ length: cars }, (_, index) =>
    makeLap({ session_id: session, car_index: index, lap_number: 1, lap_time_ms: 90_000 + index })
  );

const sessions = [
  makeSessionListItem({ id: 3, track_name: 'Monza', session_type: 'Race', player_car_index: null }),
  makeSessionListItem({ id: 2, track_name: 'Imola', session_type: 'Race', player_car_index: null }),
  makeSessionListItem({ id: 1, track_name: 'Spa', session_type: 'Qualifying', player_car_index: null }),
];

const renderModal = (onClose = vi.fn()) =>
  render(
    <I18nProvider>
      <BatchDriverModal isOpen sessionIds={[1, 2, 3]} onClose={onClose} />
    </I18nProvider>
  );

describe('BatchDriverModal', () => {
  beforeEach(() => {
    useSessionListStore.getState().reset();
    useSessionListStore.getState().setSessions(sessions);
    primeSessionLapData(3, { participants: [car(3, 0, 'SPablette'), car(3, 1, 'Rival')], laps: lapsFor(3, 2) });
    primeSessionLapData(2, { participants: [car(2, 0, 'spablette'), car(2, 1, 'Other')], laps: lapsFor(2, 2) });
    primeSessionLapData(1, { participants: [car(1, 0, 'Rival'), car(1, 1, 'SPablette')], laps: lapsFor(1, 2) });
  });
  afterEach(() => {
    invalidateSessionLapData();
    vi.restoreAllMocks();
  });

  it('suggests the names in the selected sessions, the most common first, and fills the field', async () => {
    renderModal();
    const dialog = await screen.findByRole('dialog', { name: 'Set my driver' });
    const field = within(dialog).getByRole('combobox', { name: 'Your driver name' });
    expect(field).toHaveFocus();

    const suggestions = within(dialog).getByRole('region', { name: 'Names in these sessions' });
    const chips = await within(suggestions).findAllByRole('button');
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'SPablette, in 3 of 3 sessions',
      'Rival, in 2 of 3 sessions',
      'Other, in 1 of 3 sessions',
    ]);
    expect(within(dialog).getByRole('button', { name: 'Apply to 3' })).toBeDisabled();

    fireEvent.click(chips[0]);
    expect(field).toHaveValue('SPablette');
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByRole('button', { name: 'Apply to 3' })).toBeEnabled();
  });

  it('applies the name and shows which sessions were updated, lacked the driver or had more than one', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ updated: [3], not_found: [2], ambiguous: [1] });
    vi.spyOn(api, 'get').mockResolvedValue(sessions);
    const onClose = vi.fn();
    renderModal(onClose);
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Your driver name' }), {
      target: { value: '  SPablette ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to 3' }));

    const result = await within(dialog).findByRole('status');
    expect(post).toHaveBeenCalledWith('/api/sessions/batch-player', {
      session_ids: [1, 2, 3],
      driver_name: 'SPablette',
    });
    expect(within(result).getByRole('heading', { name: 'Updated: 1' })).toBeInTheDocument();
    expect(within(result).getByRole('heading', { name: 'Without “SPablette”: 1' })).toBeInTheDocument();
    expect(within(result).getByRole('heading', { name: 'More than one “SPablette”: 1' })).toBeInTheDocument();
    expect(within(result).getByText(/^Imola · Race · /)).toBeInTheDocument();
    expect(within(result).getByText(/^Spa · Qualifying · /)).toBeInTheDocument();
    expect(within(result).queryByText(/^Monza/)).not.toBeInTheDocument();
    await waitFor(() => expect(useSessionListStore.getState().playerRevision).toBe(1));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the form and says why when the batch fails', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('boom'));
    renderModal();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'SPablette' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Apply to 3' }));
    });

    expect(useToastStore.getState().toasts.at(-1)?.message).toBe("Couldn't save your driver: boom");
    expect(within(dialog).getByRole('combobox')).toHaveValue('SPablette');
  });
});

describe('driverNameSuggestions', () => {
  it('counts each name once per session, ignoring case, and skips cars without a name', () => {
    const data = {
      participants: [
        car(1, 0, 'Max'),
        car(1, 1, 'MAX'),
        makeParticipant({ car_index: 2, name: '', driver_id: 255, race_number: 9 }),
      ],
      laps: lapsFor(1, 3),
    };
    expect(driverNameSuggestions([{ sessionType: 'Race', data }])).toEqual([{ name: 'Max', sessions: 1 }]);
  });
});
