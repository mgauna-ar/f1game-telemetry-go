import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattlePanel } from './BattlePanel';
import { TrackPositionStrip } from './TrackPositionStrip';
import { CarDetailDrawer } from './CarDetailDrawer';
import { useSessionStatusStore, useTelemetryDataStore, useTelemetryStore } from '../../store/useTelemetryStore';
import { api } from '../../utils/apiClient';
import {
  makeLiveCarStatus,
  makeLiveCarTelemetry2,
  makeLiveLap,
  makeLiveLapTimes,
  makeLiveParticipant,
  makeLiveSession,
} from '../../test/wireFactories';
import { CAR_LAPS_REFRESH_MS, F1_FORMATS, PIT_STATUS, RESULT_STATUS, SESSION_TYPES } from '../../constants/f1';
import type { LiveCarLaps } from '../../types/telemetry';

const running = { ResultStatus: RESULT_STATUS.ACTIVE };

describe('Race Control panels', () => {
  beforeEach(() => {
    useTelemetryStore.getState().resetStore();
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: SESSION_TYPES.RACE, TrackLength: 5_000 }),
      packetFormat: F1_FORMATS.FORMAT_2025,
      participants: [
        makeLiveParticipant({ Name: 'Player One' }),
        makeLiveParticipant({ Name: 'Charles Leclerc', RaceNumber: 16 }),
        makeLiveParticipant({ Name: 'Lando Norris' }),
        makeLiveParticipant({ Name: 'Oscar Piastri' }),
      ],
    });
    useTelemetryDataStore.setState({
      playerCarIndex: 0,
      allLaps: [
        makeLiveLap({ ...running, CarPosition: 2, LapDistance: 1_000, DeltaToCarInFrontMSPart: 1_234 }),
        makeLiveLap({ ...running, CarPosition: 1, LapDistance: 1_200, LastLapTimeInMS: 85_000 }),
        makeLiveLap({ ...running, CarPosition: 3, LapDistance: 900, DeltaToCarInFrontMSPart: 600 }),
        makeLiveLap({ ...running, CarPosition: 4, LapDistance: 50, PitStatus: PIT_STATUS.PITTING }),
      ],
      allCarStatus: [
        makeLiveCarStatus({ DRSAllowed: 1 }),
        makeLiveCarStatus(),
        makeLiveCarStatus({ DRSAllowed: 1 }),
        makeLiveCarStatus(),
      ],
      gapAheadTrend: { CarIndex: 1, ChangePerLapMS: -150, Laps: 3 },
      gapBehindTrend: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows the fight: neighbours, gaps, trends and DRS', () => {
    const onSelectCar = vi.fn();
    render(<BattlePanel onSelectCar={onSelectCar} />);
    expect(within(screen.getByTestId('battle-ahead')).getByText('LEC')).toBeInTheDocument();
    expect(within(screen.getByTestId('battle-behind')).getByText('NOR')).toBeInTheDocument();
    expect(screen.getByTestId('battle-gap-ahead')).toHaveTextContent('−1.234');
    expect(screen.getByTestId('battle-gap-ahead')).toHaveTextContent('Closing 0.15s/lap');
    expect(screen.getByTestId('battle-gap-behind')).toHaveTextContent('+0.600');
    // 2025 DRS for you and for the car behind, not for the leader
    expect(within(screen.getByTestId('battle-you')).getByText('DRS')).toBeInTheDocument();
    expect(within(screen.getByTestId('battle-behind')).getByText('DRS')).toBeInTheDocument();
    expect(within(screen.getByTestId('battle-ahead')).queryByText('DRS')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open Charles Leclerc' }));
    expect(onSelectCar).toHaveBeenCalledWith(1);
  });

  it('shows 2026 overtake mode instead of DRS, and best-lap gaps outside a race', () => {
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: SESSION_TYPES.Q1 }),
      packetFormat: F1_FORMATS.FORMAT_2026,
    });
    useTelemetryDataStore.setState({
      bestLapTimes: [85_500, 85_000, 86_000],
      allTelemetry2: [makeLiveCarTelemetry2({ OvertakeActive: 1 })],
    });
    render(<BattlePanel />);
    expect(screen.queryByText('DRS')).toBeNull();
    expect(within(screen.getByTestId('battle-you')).getByText('BOOST ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Gaps between best laps')).toBeInTheDocument();
    expect(screen.getByTestId('battle-gap-ahead')).toHaveTextContent('−0.500');
    expect(screen.getByTestId('battle-gap-behind')).toHaveTextContent('+0.500');
  });

  it('puts every running car round the lap, pit lane apart, and opens a car on click', () => {
    const onSelectCar = vi.fn();
    const { container } = render(<TrackPositionStrip onSelectCar={onSelectCar} />);
    const you = screen.getByRole('button', { name: 'P2 Player One' });
    expect(you).toHaveAttribute('data-role', 'you');
    expect(you.getAttribute('style')).toContain('--at: 0.2000');
    expect(screen.getByRole('button', { name: 'P1 Charles Leclerc' })).toHaveAttribute('data-role', 'neighbour');
    expect(container.querySelector('[data-lane="pit"]')).toContainElement(
      screen.getByRole('button', { name: 'P4 Oscar Piastri' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'P3 Lando Norris' }));
    expect(onSelectCar).toHaveBeenCalledWith(2);
  });

  it('waits for the track length', () => {
    useSessionStatusStore.setState({ session: makeLiveSession({ TrackLength: 0 }) });
    render(<TrackPositionStrip />);
    expect(screen.getByText('Waiting for the track length')).toBeInTheDocument();
  });

  it('shows a car’s laps and stints, reloads them, and closes on Esc', async () => {
    vi.useFakeTimers();
    useTelemetryDataStore.setState({
      allLapTimes: [makeLiveLapTimes(), makeLiveLapTimes({ BestSectorsMS: [28_000, 31_000, 26_000] })],
    });
    const history: LiveCarLaps = {
      session_uid: '0x1',
      car_index: 1,
      best_lap_num: 2,
      best_sector_lap_nums: [1, 2, 2],
      laps: [
        { lap: 1, lap_time_ms: 86_000, sectors_ms: [28_000, 31_500, 26_500], valid: true },
        { lap: 2, lap_time_ms: 85_500, sectors_ms: [28_400, 31_100, 26_000], valid: false },
      ],
      stints: [
        { end_lap: 1, actual_compound: 18, visual_compound: 18 },
        { end_lap: null, actual_compound: 17, visual_compound: 17 },
      ],
    };
    const get = vi.spyOn(api, 'get').mockResolvedValue(history);
    const onClose = vi.fn();
    render(<CarDetailDrawer carIndex={1} onClose={onClose} />);
    await act(async () => {});

    expect(get).toHaveBeenCalledWith('/api/live/cars/1/laps', expect.any(AbortSignal));
    const dialog = screen.getByRole('dialog', { name: /Charles Leclerc/ });
    expect(within(dialog).getByText('P1')).toBeInTheDocument();
    expect(within(dialog).getByText('Laps 1–1')).toBeInTheDocument();
    expect(within(dialog).getByText('From lap 2')).toBeInTheDocument();

    const rows = within(dialog).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['2', '1']);
    expect(rows[0]).toHaveAttribute('data-best');
    expect(within(rows[0]).getByText('Invalid')).toBeInTheDocument();
    // Lap 1's S1 matches the session best (purple); lap 2's S3 is the car's own best (green)
    expect(within(rows[1]).getByText('28.000')).toHaveAttribute('data-sector', 'session');
    expect(within(rows[0]).getByText('26.000')).toHaveAttribute('data-sector', 'session');
    expect(within(rows[0]).getByText('31.100')).toHaveAttribute('data-sector', 'personal');

    await act(async () => {
      vi.advanceTimersByTime(CAR_LAPS_REFRESH_MS);
    });
    expect(get).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows placeholders while the laps load, and says so when loading fails', async () => {
    let fail: (err: Error) => void = () => {};
    vi.spyOn(api, 'get').mockImplementation(() => new Promise((_, reject) => (fail = reject)));
    render(<CarDetailDrawer carIndex={2} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading laps…');

    await act(async () => fail(new Error('offline')));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('says so when a car has no completed laps', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      session_uid: '',
      car_index: 2,
      best_lap_num: 0,
      best_sector_lap_nums: [0, 0, 0],
      laps: [],
      stints: [],
    } satisfies LiveCarLaps);
    render(<CarDetailDrawer carIndex={2} onClose={vi.fn()} />);
    expect(await screen.findByText('No completed laps yet')).toBeInTheDocument();
  });
});
