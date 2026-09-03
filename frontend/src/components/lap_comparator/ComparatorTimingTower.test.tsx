import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparatorTimingTower } from './ComparatorTimingTower';
import type { Participant, Lap } from '../../types/session';
import type { QuickSelectDriver } from '../../types/comparator';

describe('ComparatorTimingTower Component', () => {
  const mockLap1: Lap = {
    id: 101,
    session_id: 1,
    car_index: 0,
    lap_number: 10,
    lap_time_ms: 80000,
    sector1_ms: 26000,
    sector2_ms: 28000,
    sector3_ms: 26000,
    is_valid: true,
    tyre_compound: 'SOFT',
    has_telemetry: true,
  };

  const mockLap2: Lap = {
    id: 102,
    session_id: 1,
    car_index: 1,
    lap_number: 12,
    lap_time_ms: 80350,
    sector1_ms: 26100,
    sector2_ms: 28100,
    sector3_ms: 26150,
    is_valid: true,
    tyre_compound: 'MEDIUM',
    has_telemetry: true,
  };

  const mockLap3: Lap = {
    id: 103,
    session_id: 1,
    car_index: 2,
    lap_number: 8,
    lap_time_ms: 80600,
    sector1_ms: 26200,
    sector2_ms: 28200,
    sector3_ms: 26200,
    is_valid: true,
    tyre_compound: 'HARD',
    has_telemetry: false,
  };

  const mockDrivers: QuickSelectDriver[] = [
    {
      id: 1,
      session_id: 1,
      car_index: 0,
      name: 'Max Verstappen',
      race_number: 1,
      team_id: 2,
      driver_id: 1,
      ai_controlled: false,
      nationality: 1,
      bestLap: mockLap1,
    },
    {
      id: 2,
      session_id: 1,
      car_index: 1,
      name: 'Liam Lawson',
      race_number: 30,
      team_id: 2,
      driver_id: 2,
      ai_controlled: false,
      nationality: 2,
      bestLap: mockLap2,
    },
    {
      id: 3,
      session_id: 1,
      car_index: 2,
      name: 'Lando Norris',
      race_number: 4,
      team_id: 8,
      driver_id: 3,
      ai_controlled: false,
      nationality: 3,
      bestLap: mockLap3,
    },
  ];

  const defaultProps = {
    isOpen: true,
    onToggleOpen: vi.fn(),
    quickSelectData: {
      drivers: mockDrivers,
      totalCount: 3,
      leaderLapTimeMs: 80000,
    },
    driverSearchQuery: '',
    onDriverSearchChange: vi.fn(),
    isLinkedSessions: true,
    sessionAId: 1,
    sessionBId: 1,
    quickSelectSessionTab: 'ALL' as const,
    onQuickSelectSessionTabChange: vi.fn(),
    lapAId: 101,
    lapBId: 103,
    lapsA: [mockLap1, mockLap2, mockLap3],
    lapsB: [mockLap1, mockLap2, mockLap3],
    onSetLapA: vi.fn(),
    onSetLapB: vi.fn(),
    participantsA: mockDrivers as Participant[],
    slotADriver: mockDrivers[0],
    slotBDriver: mockDrivers[2],
    lapAObj: mockLap1,
    lapBObj: mockLap3,
  };

  it('renders timing tower table with ranks, gaps, and action buttons', () => {
    render(<ComparatorTimingTower {...defaultProps} />);

    expect(screen.getByTestId('timing-tower-table')).toBeInTheDocument();
    expect(screen.getByTestId('rank-badge-1')).toHaveTextContent('P1');
    expect(screen.getByTestId('rank-badge-2')).toHaveTextContent('P2');
    expect(screen.getByTestId('rank-badge-3')).toHaveTextContent('P3');

    // Gap checks
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getAllByText('+0.350s').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+0.600s').length).toBeGreaterThan(0);
  });

  it('triggers vs Leader preset', () => {
    render(<ComparatorTimingTower {...defaultProps} />);

    const vsLeaderBtn = screen.getByTestId('preset-vs-leader');
    fireEvent.click(vsLeaderBtn);

    expect(defaultProps.onSetLapB).toHaveBeenCalledWith(101);
  });

  it('triggers vs Teammate preset', () => {
    render(<ComparatorTimingTower {...defaultProps} />);

    const vsTeammateBtn = screen.getByTestId('preset-vs-teammate');
    fireEvent.click(vsTeammateBtn);

    // Lawson is Verstappen's teammate (both team_id: 2)
    expect(defaultProps.onSetLapB).toHaveBeenCalledWith(102);
  });

  it('triggers Next Ahead preset', () => {
    // If Slot A is driver at index 1 (Lawson), next ahead is Verstappen at index 0
    render(<ComparatorTimingTower {...defaultProps} slotADriver={mockDrivers[1]} lapAObj={mockLap2} />);

    const nextAheadBtn = screen.getByTestId('preset-next-ahead');
    fireEvent.click(nextAheadBtn);

    expect(defaultProps.onSetLapB).toHaveBeenCalledWith(101);
  });

  it('handles Setting Rival (B) and Baseline (A) directly from rows', () => {
    render(<ComparatorTimingTower {...defaultProps} />);

    const setRivalBtn = screen.getByTestId('tower-set-rival-1');
    fireEvent.click(setRivalBtn);
    expect(defaultProps.onSetLapB).toHaveBeenCalledWith(102);

    const setBaseBtn = screen.getByTestId('tower-set-baseline-1');
    fireEvent.click(setBaseBtn);
    expect(defaultProps.onSetLapA).toHaveBeenCalledWith(102);
  });

  it('expands driver lap history drilldown', () => {
    render(<ComparatorTimingTower {...defaultProps} />);

    const expandBtn = screen.getByTestId('tower-expand-laps-0');
    fireEvent.click(expandBtn);

    expect(screen.getByText(/Max Verstappen - Recorded Laps/i)).toBeInTheDocument();
  });
});
