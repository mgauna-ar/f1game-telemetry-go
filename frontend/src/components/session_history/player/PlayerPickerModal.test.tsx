import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import { makeLap, makeParticipant, makeSession, makeSessionListItem } from '../../../test/wireFactories';
import { api } from '../../../utils/apiClient';
import { primeSessionLapData } from '../../../utils/sessionDataCache';
import { PlayerPickerModal } from './PlayerPickerModal';
import { pickerParticipants } from './pickerParticipants';
import { openPlayerPicker, usePlayerPickerStore } from './playerPickerStore';

const participants = [
  makeParticipant({ session_id: 5, car_index: 0, name: 'Max Verstappen', race_number: 1, team_id: 2, position: 2 }),
  makeParticipant({ session_id: 5, car_index: 1, name: '', driver_id: 0, race_number: 55, team_id: 1, position: 1 }),
  makeParticipant({ session_id: 5, car_index: 2, name: 'Lando Norris', race_number: 4, team_id: 8, position: 3 }),
];
const laps = [0, 1, 2].map((car) =>
  makeLap({ id: 50 + car, session_id: 5, car_index: car, lap_number: 1, lap_time_ms: 80_000 + car * 100 })
);

const renderPicker = () =>
  render(
    <I18nProvider>
      <PlayerPickerModal />
    </I18nProvider>
  );

describe('PlayerPickerModal', () => {
  beforeEach(() => {
    useSessionListStore.getState().reset();
    primeSessionLapData(5, { participants, laps });
  });
  afterEach(() => {
    act(() => usePlayerPickerStore.getState().closePlayerPicker());
    vi.restoreAllMocks();
  });

  it('lists the drivers as a radio group in classification order, with your car marked and a None row', async () => {
    renderPicker();
    act(() =>
      openPlayerPicker(
        makeSession({
          id: 5,
          track_name: 'Monza',
          session_type: 'Race',
          player_car_index: 0,
          player_car_source: 'game',
        })
      )
    );

    const dialog = await screen.findByRole('dialog', { name: 'Who were you?' });
    expect(within(dialog).getByText('Monza · Race')).toBeInTheDocument();
    const group = within(dialog).getByRole('group', { name: 'Drivers in this session' });
    const radios = within(group).getAllByRole('radio');
    // A driver without a name gets the game's name for their driver ID
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      'P1#55Carlos Sainz',
      'P2#1Max VerstappenRecorded',
      'P3#4Lando Norris',
      "None: I wasn't driving",
    ]);
    expect(within(group).getByRole('radio', { name: /Max Verstappen/ })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a pick through the list store, tells you, and closes', async () => {
    const put = vi
      .spyOn(api, 'put')
      .mockResolvedValue(makeSession({ id: 5, player_car_index: 2, player_car_source: 'user' }));
    vi.spyOn(api, 'get').mockResolvedValue([
      makeSessionListItem({ id: 5, player_car_index: 2, player_car_source: 'user' }),
    ]);
    renderPicker();
    act(() => openPlayerPicker(makeSession({ id: 5, track_name: 'Monza', session_type: 'Race' })));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('radio', { name: /Lando Norris/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(put).toHaveBeenCalledWith('/api/sessions/5/player', { car_index: 2 });
    expect(useToastStore.getState().toasts.at(-1)?.message).toBe('Lando Norris is now your driver in this session');
    expect(useSessionListStore.getState().playerRevision).toBe(1);
  });

  it('keeps the dialog open and says why when the save fails', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new Error('that car is not in this session'));
    renderPicker();
    act(() => openPlayerPicker(makeSession({ id: 5, player_car_index: 0, player_car_source: 'user' })));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Your pick')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('radio', { name: "None: I wasn't driving" }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
        "Couldn't save your driver: that car is not in this session"
      )
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says so when the drivers cannot be loaded', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('boom'));
    renderPicker();
    act(() => openPlayerPicker(makeSession({ id: 404 })));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the drivers");
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('pickerParticipants', () => {
  it('takes a position from the last lap when the session stored none, as the classification does', () => {
    const cars = [
      makeParticipant({ car_index: 0, name: 'A', position: 0 }),
      makeParticipant({ car_index: 1, name: 'B', position: 0 }),
    ];
    const race = [
      makeLap({ car_index: 0, lap_number: 1, car_position: 1, lap_time_ms: 90_000 }),
      makeLap({ car_index: 0, lap_number: 2, car_position: 2, lap_time_ms: 90_000 }),
      makeLap({ car_index: 1, lap_number: 1, car_position: 2, lap_time_ms: 91_000 }),
      makeLap({ car_index: 1, lap_number: 2, car_position: 1, lap_time_ms: 91_000 }),
    ];
    expect(pickerParticipants(cars, race, 'Race').map((p) => [p.name, p.position])).toEqual([
      ['B', 1],
      ['A', 2],
    ]);
  });

  it('orders a session without positions by best lap, and leaves out empty grid slots', () => {
    const cars = [
      makeParticipant({ car_index: 0, name: 'Slow', position: 0 }),
      makeParticipant({ car_index: 1, name: 'Quick', position: 0 }),
      makeParticipant({ car_index: 2, name: '', position: 0, ai_controlled: true }),
    ];
    const times = [makeLap({ car_index: 0, lap_time_ms: 90_000 }), makeLap({ car_index: 1, lap_time_ms: 89_000 })];
    expect(pickerParticipants(cars, times, 'Short Qualifying').map((p) => p.name)).toEqual(['Quick', 'Slow']);
  });
});
