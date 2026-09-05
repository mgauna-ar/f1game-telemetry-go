import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SessionDetailHeader } from './SessionDetailHeader';
import { I18nProvider } from '../../context/I18nProvider';
import type { Session } from '../../types/session';

describe('SessionDetailHeader Component', () => {
  const mockRaceSession: Session = {
    id: 1,
    session_uid: '0x1234567890abcdef',
    track_name: 'Silverstone',
    session_type: 'Race',
    packet_format: 2026,
    created_at: '2026-07-12T14:00:00Z',
  };

  const mockQualySession: Session = {
    id: 2,
    session_uid: '0xabcdef1234567890',
    track_name: 'Silverstone',
    session_type: 'Qualifying 1',
    packet_format: 2026,
    created_at: '2026-07-11T14:00:00Z',
  };

  it('renders Progression tab button when session is a Race session', () => {
    const setActiveDetailTab = vi.fn();
    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockRaceSession}
          isRaceSession={true}
          activeDetailTab="classification"
          setActiveDetailTab={setActiveDetailTab}
          totalSessionLaps={52}
          totalDriversCount={20}
        />
      </I18nProvider>
    );

    const progressionBtn = screen.getByRole('button', { name: /Lap Progression & Gap Charts/i });
    expect(progressionBtn).toBeInTheDocument();

    fireEvent.click(progressionBtn);
    expect(setActiveDetailTab).toHaveBeenCalledWith('charts');
  });

  it('does NOT render Progression tab button when session is Qualifying or not a race', () => {
    const setActiveDetailTab = vi.fn();
    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockQualySession}
          isRaceSession={false}
          activeDetailTab="classification"
          setActiveDetailTab={setActiveDetailTab}
          totalSessionLaps={15}
          totalDriversCount={20}
        />
      </I18nProvider>
    );

    const progressionBtn = screen.queryByRole('button', { name: /Lap Progression & Gap Charts/i });
    expect(progressionBtn).not.toBeInTheDocument();

    // Other tabs should still exist
    expect(screen.getByRole('button', { name: /Classification & Laps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tyre Strategy & Stints/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sector & Speed Matrix/i })).toBeInTheDocument();
  });
});
