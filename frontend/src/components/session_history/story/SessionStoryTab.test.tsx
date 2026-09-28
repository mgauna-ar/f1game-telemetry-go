import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../context/I18nProvider';
import { normalizeDriverStanding, type FeedEvent, type ProgressionResponse } from '../../../types/session';
import { makeDriverStanding, makeFeedEvent, makeParticipant, makeSession } from '../../../test/wireFactories';
import { SessionStoryTab } from './SessionStoryTab';
import { usePlayerPickerStore } from '../player/playerPickerStore';

const participants = [0, 1, 2].map((car) =>
  makeParticipant({
    car_index: car,
    name: ['Lewis Hamilton', 'Lando Norris', 'Oscar Piastri'][car],
    race_number: car + 1,
  })
);
const standings = participants.map((p, i) =>
  normalizeDriverStanding(
    makeDriverStanding({
      position: i + 1,
      car_index: p.car_index,
      driver_name: p.name,
      best_lap_time_ms: 88_000 + i * 400,
    }),
    1,
    new Map(participants.map((x) => [x.car_index, x])),
    new Map()
  )
);
const progression: ProgressionResponse = {
  lap_pace: [
    { lapNumber: 1, driver_0: 90, driver_1: 89.5, driver_2: 91 },
    { lapNumber: 2, driver_0: 89, driver_1: 89.4, driver_2: 90 },
  ],
  positions: [],
  gap_to_leader: [],
  drivers: [],
  total_session_laps: 2,
};
const events: FeedEvent[] = [
  makeFeedEvent({ eventCode: 'LGOT', type: 'general', severity: 'success', raceLap: 1 }),
  makeFeedEvent({
    eventCode: 'OVTK',
    type: 'overtake',
    vehicleIdx: 1,
    driverName: 'Lando Norris',
    otherVehicleIdx: 0,
    targetDriverName: 'Lewis Hamilton',
    raceLap: 2,
  }),
  makeFeedEvent({ eventCode: 'SCAR', type: 'flag', severity: 'warning', safetyCarStatus: 1, raceLap: 2 }),
  makeFeedEvent({
    eventCode: 'RTMT',
    type: 'retirement',
    severity: 'danger',
    vehicleIdx: 2,
    driverName: 'Oscar Piastri',
    raceLap: 2,
  }),
];

const renderStory = (props: Partial<React.ComponentProps<typeof SessionStoryTab>> = {}) =>
  render(
    <I18nProvider>
      <SessionStoryTab
        session={makeSession({ id: 1, session_type: 'Race' })}
        driverStandings={standings}
        progressionData={progression}
        events={events}
        isRaceSession
        playerCarIndex={1}
        playerSource="recorded"
        formatLapTime={(ms) => `${ms}ms`}
        {...props}
      />
    </I18nProvider>
  );

describe('SessionStoryTab', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tells the race: your result, your pace against the field and the key moments', () => {
    renderStory();
    expect(screen.getByTestId('your-race')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your pace against the field' })).toBeInTheDocument();
    // Lap 1: −0.5 to a median of 90; lap 2 is under the safety car and left out
    expect(screen.getByText('0.500s a lap faster than the field median over 1 clean laps')).toBeInTheDocument();

    const timeline = screen.getByRole('list', { name: 'Key moments' });
    expect(within(timeline).getByText('Lando Norris overtook Lewis Hamilton')).toBeInTheDocument();
    expect(within(timeline).getByText('Full Safety Car Deployed')).toBeInTheDocument();
    expect(within(timeline).getByText('Oscar Piastri retired from the session')).toBeInTheDocument();
    expect(screen.getByText('1 safety car(s) · 1 retirement(s)')).toBeInTheDocument();

    // Only yours
    fireEvent.click(screen.getByRole('radio', { name: 'Yours (1)' }));
    expect(within(timeline).queryByText('Full Safety Car Deployed')).not.toBeInTheDocument();
    expect(within(timeline).getByText('Lando Norris overtook Lewis Hamilton')).toBeInTheDocument();
  });

  it('says why a session recorded before the events were stored has no timeline', () => {
    renderStory({ events: [], playerCarIndex: null });
    expect(screen.queryByRole('list', { name: 'Key moments' })).not.toBeInTheDocument();
    expect(screen.getByText(/recorded before race-control events were saved/)).toBeInTheDocument();
    const note = screen.getByTestId('no-driver');
    expect(note).toHaveTextContent(/Which car was yours isn't known for this session/);
    fireEvent.click(within(note).getByRole('button', { name: 'Pick your driver' }));
    expect(usePlayerPickerStore.getState().session?.id).toBe(1);
    act(() => usePlayerPickerStore.getState().closePlayerPicker());
    expect(screen.queryByRole('heading', { name: 'Your pace against the field' })).not.toBeInTheDocument();
  });

  it('writes the debrief only when asked', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderStory();
    expect(screen.getByRole('heading', { name: 'Race engineer debrief' })).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    // No AI key saved: the missing key card shows instead of a request
    fireEvent.click(screen.getByRole('button', { name: 'Write the debrief' }));
    expect(screen.getByTestId('ai-error-card')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
