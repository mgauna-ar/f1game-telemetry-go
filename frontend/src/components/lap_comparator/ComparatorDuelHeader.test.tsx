import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComparatorDuelHeader } from './ComparatorDuelHeader';
import type { Session, Participant, Lap } from '../../types/session';

describe('ComparatorDuelHeader Component', () => {
  const mockSessionA: Session = {
    id: 1,
    session_uid: '0x101',
    session_type: 'Qualifying',
    track_name: 'Silverstone',
    created_at: '2026-08-10T12:00:00Z',
  };

  const mockDriverA: Participant = {
    id: 1,
    session_id: 1,
    car_index: 0,
    name: 'Max Verstappen',
    race_number: 1,
    team_id: 2,
    driver_id: 1,
    ai_controlled: false,
    nationality: 1,
  };

  const mockDriverB: Participant = {
    id: 2,
    session_id: 1,
    car_index: 1,
    name: 'Lando Norris',
    race_number: 4,
    team_id: 8,
    driver_id: 2,
    ai_controlled: false,
    nationality: 2,
  };

  const mockLapA: Lap = {
    id: 101,
    session_id: 1,
    car_index: 0,
    lap_number: 12,
    lap_time_ms: 87234,
    sector1_ms: 27500,
    sector2_ms: 32100,
    sector3_ms: 27634,
    is_valid: true,
    tyre_compound: 'SOFT',
    max_speed_kmh: 324,
    has_telemetry: true,
  };

  const mockLapB: Lap = {
    id: 102,
    session_id: 1,
    car_index: 1,
    lap_number: 14,
    lap_time_ms: 87480,
    sector1_ms: 27600,
    sector2_ms: 32000,
    sector3_ms: 27880,
    is_valid: true,
    tyre_compound: 'MEDIUM',
    max_speed_kmh: 320,
    has_telemetry: true,
  };

  const defaultProps = {
    sessions: [mockSessionA],
    selectedSessionAObj: mockSessionA,
    selectedSessionBObj: mockSessionA,
    isLinkedSessions: true,
    toggleSessionLink: vi.fn(),
    lapAObj: mockLapA,
    lapBObj: mockLapB,
    totalDeltaMs: -246,
    handleSwapSlots: vi.fn(),
    isTimingTowerOpen: false,
    setIsTimingTowerOpen: vi.fn(),
    timingTowerTotalCount: 20,
    handleClearSelections: vi.fn(),
    slotA: {
      driver: mockDriverA,
      laps: [mockLapA],
      participants: [mockDriverA, mockDriverB],
      lapId: 101,
      setLapId: vi.fn(),
    },
    slotB: {
      driver: mockDriverB,
      laps: [mockLapB],
      participants: [mockDriverA, mockDriverB],
      lapId: 102,
      setLapId: vi.fn(),
    },
    filteredDropdownSessionsA: [mockSessionA],
    filteredDropdownSessionsB: [mockSessionA],
    isSessionADropdownOpen: false,
    setIsSessionADropdownOpen: vi.fn(),
    isSessionBDropdownOpen: false,
    setIsSessionBDropdownOpen: vi.fn(),
    sessionASearchQuery: '',
    setSessionASearchQuery: vi.fn(),
    sessionBSearchQuery: '',
    setSessionBSearchQuery: vi.fn(),
    sessionATypeTab: 'ALL' as const,
    setSessionATypeTab: vi.fn(),
    sessionBTypeTab: 'ALL' as const,
    setSessionBTypeTab: vi.fn(),
    handleSelectSessionA: vi.fn(),
    handleSelectSessionB: vi.fn(),
    s1Delta: -100,
    s2Delta: 100,
    s3Delta: -246,
  };

  it('renders duel matchup with baseline driver, rival driver, and delta', () => {
    render(<ComparatorDuelHeader {...defaultProps} />);

    expect(screen.getByText('Lap Comparator')).toBeInTheDocument();
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.getByText('Lando Norris')).toBeInTheDocument();
    expect(screen.getByText('324 km/h')).toBeInTheDocument();
    expect(screen.getByText('320 km/h')).toBeInTheDocument();

    // Check delta badge (Verstappen faster)
    expect(screen.getByTestId('duel-delta-badge')).toHaveTextContent(/Δ -0.246s/);
  });

  it('handles slot swapping and clearing', () => {
    render(<ComparatorDuelHeader {...defaultProps} />);

    const swapBtn = screen.getByTestId('duel-swap-slots-btn');
    fireEvent.click(swapBtn);
    expect(defaultProps.handleSwapSlots).toHaveBeenCalled();

    const clearBtn = screen.getByTestId('duel-clear-selections-btn');
    fireEvent.click(clearBtn);
    expect(defaultProps.handleClearSelections).toHaveBeenCalled();
  });

  it('opens and closes driver selection popover', () => {
    render(<ComparatorDuelHeader {...defaultProps} />);

    const driverTriggerA = screen.getByTestId('slot-a-driver-trigger');
    fireEvent.click(driverTriggerA);

    expect(screen.getByTestId('slot-a-driver-popover')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search driver or number...')).toBeInTheDocument();
  });

  it('opens and closes lap selection popover', () => {
    render(<ComparatorDuelHeader {...defaultProps} />);

    const lapTriggerA = screen.getByTestId('lap-a-trigger');
    fireEvent.click(lapTriggerA);

    expect(screen.getByTestId('slot-a-lap-popover')).toBeInTheDocument();
  });

  it('toggles timing tower expansion', () => {
    render(<ComparatorDuelHeader {...defaultProps} />);

    const towerToggle = screen.getByTestId('toggle-quick-select-toolbar-btn');
    fireEvent.click(towerToggle);

    expect(defaultProps.setIsTimingTowerOpen).toHaveBeenCalled();
  });
});
