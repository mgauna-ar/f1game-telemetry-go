import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RaceControlFeed } from './RaceControlFeed';
import type { RaceEvent, SessionData } from '../hooks/useTelemetry';

describe('RaceControlFeed', () => {
  const mockSession: SessionData = {
    Weather: 0,
    TrackTemperature: 32,
    AirTemperature: 24,
    TotalLaps: 58,
    TrackLength: 5303,
    SessionType: 15,
    TrackId: 0,
    SessionTimeLeft: 3600,
    SessionDuration: 7200,
    SafetyCarStatus: 0,
  };

  const mockEvents: RaceEvent[] = [
    {
      id: '1',
      timestamp: Date.now(),
      eventCode: 'FTLP',
      type: 'fastest_lap',
      description: 'Lando Norris set the fastest lap (82.115s)',
      severity: 'purple',
    },
    {
      id: '2',
      timestamp: Date.now() - 1000,
      eventCode: 'OVTK',
      type: 'overtake',
      description: 'Charles Leclerc overtook Carlos Sainz',
      severity: 'info',
    },
    {
      id: '3',
      timestamp: Date.now() - 2000,
      eventCode: 'PENA',
      type: 'penalty',
      description: 'Max Verstappen received a 5s time penalty',
      severity: 'danger',
    },
  ];

  it('renders title and track status correctly', () => {
    render(<RaceControlFeed events={mockEvents} session={mockSession} />);
    expect(screen.getByText(/Race Control & Incidents/i)).toBeInTheDocument();
    expect(screen.getByText(/TRACK CLEAR/i)).toBeInTheDocument();
  });

  it('displays safety car badge when safety car is deployed', () => {
    const scSession: SessionData = { ...mockSession, SafetyCarStatus: 1 };
    render(<RaceControlFeed events={mockEvents} session={scSession} />);
    expect(screen.getByText(/SAFETY CAR/i)).toBeInTheDocument();
  });

  it('renders event descriptions in the feed stream', () => {
    render(<RaceControlFeed events={mockEvents} session={mockSession} />);
    expect(screen.getByText(/Lando Norris set the fastest lap/i)).toBeInTheDocument();
    expect(screen.getByText(/Charles Leclerc overtook Carlos Sainz/i)).toBeInTheDocument();
    expect(screen.getByText(/Max Verstappen received a 5s time penalty/i)).toBeInTheDocument();
  });

  it('filters events when filter tabs are clicked', () => {
    render(<RaceControlFeed events={mockEvents} session={mockSession} />);

    // Click Penalties filter
    const penaltyBtn = screen.getByRole('button', { name: /Penalties/i });
    fireEvent.click(penaltyBtn);

    expect(screen.getByText(/Max Verstappen received a 5s time penalty/i)).toBeInTheDocument();
    expect(screen.queryByText(/Charles Leclerc overtook Carlos Sainz/i)).not.toBeInTheDocument();
  });

  it('calls onClearEvents when clear button is clicked', () => {
    const handleClear = vi.fn();
    render(<RaceControlFeed events={mockEvents} session={mockSession} onClearEvents={handleClear} />);

    const clearBtn = screen.getByRole('button', { name: /clear all race control events/i });
    fireEvent.click(clearBtn);

    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
