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

  it('renders SessionTypeBadge with contextual motorsport style and handles UID copy', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockQualySession}
          isRaceSession={false}
          totalSessionLaps={15}
          totalDriversCount={20}
        />
      </I18nProvider>
    );

    // Verify SessionTypeBadge is rendered
    expect(screen.getByText('Qualifying 1')).toBeInTheDocument();

    // Verify Copy UID button
    const copyBtn = screen.getByLabelText(/Copy session UID/i);
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('0xabcdef1234567890');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('triggers onOpenAiDebrief, onExportSession, and onRequestDelete handlers', () => {
    const onOpenAiDebrief = vi.fn();
    const onExportSession = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockRaceSession}
          onOpenAiDebrief={onOpenAiDebrief}
          onExportSession={onExportSession}
          onRequestDelete={onRequestDelete}
        />
      </I18nProvider>
    );

    const debriefBtn = screen.getByRole('button', { name: /AI Race Engineer Debrief/i });
    fireEvent.click(debriefBtn);
    expect(onOpenAiDebrief).toHaveBeenCalledTimes(1);

    const exportBtn = screen.getByRole('button', { name: /Export/i });
    fireEvent.click(exportBtn);
    expect(onExportSession).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });
});
