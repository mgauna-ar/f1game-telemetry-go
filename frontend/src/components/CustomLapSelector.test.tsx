import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomLapSelector } from './CustomLapSelector';

describe('CustomLapSelector Component', () => {
  const mockLaps = [
    { id: 101, session_id: 1, car_index: 0, lap_number: 1, lap_time_ms: 90000, sector1_ms: 30000, sector2_ms: 32000, sector3_ms: 28000, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 310 },
    { id: 102, session_id: 1, car_index: 0, lap_number: 2, lap_time_ms: 88500, sector1_ms: 29500, sector2_ms: 31500, sector3_ms: 27500, is_valid: true, tyre_compound: 'SOFT', max_speed_kmh: 315 },
    { id: 103, session_id: 1, car_index: 1, lap_number: 3, lap_time_ms: 0, is_valid: false, tyre_compound: 'HARD' },
  ];

  const mockParticipants = [
    { id: 1, session_id: 1, car_index: 0, name: 'Lewis Hamilton', driver_id: 1, team_id: 1, race_number: 44, ai_controlled: false, nationality: 1 },
    { id: 2, session_id: 1, car_index: 1, name: 'George Russell', driver_id: 2, team_id: 1, race_number: 63, ai_controlled: false, nationality: 1 }
  ];

  it('renders trigger with selected lap and opens popover on click', () => {
    const onSelect = vi.fn();
    render(
      <CustomLapSelector
        laps={mockLaps}
        participants={mockParticipants}
        selectedLapId={102}
        onSelectLap={onSelect}
        slot="A"
      />
    );

    const trigger = screen.getByTestId('lap-a-trigger');
    expect(trigger).toHaveTextContent('Lewis Hamilton');
    expect(trigger).toHaveTextContent('1:28.500');

    // Click trigger to open popover
    fireEvent.click(trigger);

    // Popover elements should be visible
    expect(screen.getByPlaceholderText('Search driver, lap #, time...')).toBeInTheDocument();
    expect(screen.getByText('1:30.000')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();

    // Select lap 101
    fireEvent.click(screen.getByText('1:30.000'));
    expect(onSelect).toHaveBeenCalledWith(101);
  });

  it('filters by driver tabs and valid only toggle', () => {
    render(
      <CustomLapSelector
        laps={mockLaps}
        participants={mockParticipants}
        selectedLapId=""
        onSelectLap={vi.fn()}
        slot="B"
      />
    );

    const trigger = screen.getByTestId('lap-b-trigger');
    fireEvent.click(trigger);

    // Filter to George Russell
    const russellTab = screen.getByRole('button', { name: /#63 George Russell/i });
    fireEvent.click(russellTab);

    // Only Russell's lap should be visible
    expect(screen.getAllByText(/#63 George Russell/).length).toBeGreaterThan(0);
    expect(screen.getByRole('option')).toHaveTextContent('George Russell');
    expect(screen.queryByRole('option', { name: /Lewis Hamilton/ })).not.toBeInTheDocument();

    // Toggle Valid Only -> Russell's lap is invalid so list should be empty
    const validOnlyBtn = screen.getByRole('button', { name: /Valid Only/i });
    fireEvent.click(validOnlyBtn);
    expect(screen.getByText('No laps match your filter.')).toBeInTheDocument();
  });
});
