import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverGlance } from './DriverGlance';
import { useTelemetryStore, useSessionStatusStore, useTelemetryDataStore } from '../../store/useTelemetryStore';
import {
  makeLiveCarDamage,
  makeLiveCarStatus,
  makeLiveCarTelemetry,
  makeLiveLap,
  makeLiveParticipant,
  makeLiveSession,
} from '../../test/wireFactories';
import { SAFETY_CAR_STATUS, SESSION_TYPES, VEHICLE_FIA_FLAGS } from '../../constants/f1';

vi.mock('../../hooks/useScreenWakeLock', () => ({
  useScreenWakeLock: () => ({ mode: 'blocked', retry: vi.fn() }),
}));

const renderGlance = () => render(<DriverGlance viewMode="driver" onViewModeChange={vi.fn()} />);

describe('DriverGlance', () => {
  beforeEach(() => {
    useTelemetryStore.getState().resetStore();
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: SESSION_TYPES.RACE, TotalLaps: 58 }),
      participants: [
        makeLiveParticipant({ Name: 'Player' }),
        makeLiveParticipant({ Name: 'Charles Leclerc' }),
        makeLiveParticipant({ Name: 'Lando Norris' }),
      ],
    });
    useTelemetryDataStore.setState({
      playerCarIndex: 0,
      allLaps: [
        makeLiveLap({ CarPosition: 2, CurrentLapNum: 12, LastLapTimeInMS: 91_236, DeltaToCarInFrontMSPart: 1_234 }),
        makeLiveLap({ CarPosition: 1 }),
        makeLiveLap({ CarPosition: 3, DeltaToCarInFrontMSPart: 800 }),
      ],
      bestLapTimes: [91_000],
      allCarStatus: [makeLiveCarStatus({ FuelRemainingLaps: 1.2, FuelInTank: 20 })],
      allCarDamage: [makeLiveCarDamage({ TyresWear: [10, 50, 80, 20] })],
      allTelemetry: [makeLiveCarTelemetry()],
      gapAheadTrend: { CarIndex: 1, ChangePerLapMS: -150, Laps: 3 },
      gapBehindTrend: { CarIndex: 2, ChangePerLapMS: -200, Laps: 2 },
    });
  });

  it('shows position, gaps with trends, last vs best lap, fuel and tyres', () => {
    renderGlance();
    expect(screen.getByTestId('driver-position')).toHaveTextContent('P2/3');
    expect(screen.getByText('Lap 12/58')).toBeInTheDocument();
    expect(screen.getByTestId('driver-gap-ahead')).toHaveTextContent('−1.234');
    expect(screen.getByText('LEC')).toBeInTheDocument();
    expect(screen.getByText('Closing 0.15s/lap').closest('dd')).toHaveAttribute('data-good', 'true');
    expect(screen.getByTestId('driver-gap-behind')).toHaveTextContent('+0.800');
    expect(screen.getByText('Closing 0.20s/lap').closest('dd')).toHaveAttribute('data-good', 'false');
    expect(screen.getByText('1:31.236')).toBeInTheDocument();
    expect(screen.getByText('+0.236')).toBeInTheDocument();
    expect(screen.getByText('1:31.000')).toBeInTheDocument();
    expect(screen.getByText('+1.2', { exact: false }).closest('dd')).toHaveTextContent('+1.2laps');
    expect(screen.getByText('80%').closest('[data-level]')).toHaveAttribute('data-level', 'critical');
    // Wheel arrays are RL, RR, FL, FR: index 2 is the front left
    expect(screen.getByText('FL').closest('[data-level]')).toHaveTextContent('80%');
    expect(screen.getByText('RL').closest('[data-level]')).toHaveTextContent('10%');
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByTestId('driver-flag')).toBeNull();
  });

  it('shows the flag and warnings, and the auto-lock tip when the screen can’t be kept on', () => {
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: SESSION_TYPES.RACE, SafetyCarStatus: SAFETY_CAR_STATUS.CLEAR }),
    });
    useTelemetryDataStore.setState({
      allCarStatus: [makeLiveCarStatus({ VehicleFIAFlags: VEHICLE_FIA_FLAGS.BLUE })],
      allLaps: [makeLiveLap({ CarPosition: 1, Penalties: 5, CornerCuttingWarnings: 2 })],
    });
    renderGlance();
    expect(screen.getByTestId('driver-flag')).toHaveTextContent('Blue flag');
    expect(screen.getByTestId('driver-glance')).toHaveAttribute('data-flag', 'blue');
    expect(screen.getByText('+5s penalty')).toBeInTheDocument();
    expect(screen.getByText('Track limits: 2')).toBeInTheDocument();
    const tip = screen.getByRole('note');
    expect(within(tip).getByRole('button', { name: 'Keep screen on' })).toBeInTheDocument();
  });

  it('shows the time left and the gap to P1 outside a race', () => {
    useSessionStatusStore.setState({
      session: makeLiveSession({ SessionType: SESSION_TYPES.Q1, SessionTimeLeft: 754 }),
    });
    useTelemetryDataStore.setState({ bestLapTimes: [91_000, 90_500] });
    renderGlance();
    expect(screen.getByText('12:34 left')).toBeInTheDocument();
    expect(screen.getByText('Gap to P1').nextSibling).toHaveTextContent('+0.500');
    expect(screen.queryByTestId('driver-gap-ahead')).toBeNull();
  });
});
