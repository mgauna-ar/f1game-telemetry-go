import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SessionDetailHeader } from './SessionDetailHeader';
import { I18nProvider } from '../../context/I18nProvider';
import type { Session } from '../../types/session';
import { makeSession } from '../../test/wireFactories';

describe('SessionDetailHeader Component', () => {
  const mockRaceSession: Session = makeSession({
    id: 1,
    session_uid: '0x1234567890abcdef',
    track_name: 'Silverstone',
    session_type: 'Race',
    packet_format: 2026,
    created_at: '2026-07-12T14:00:00Z',
  });

  const mockQualySession: Session = makeSession({
    id: 2,
    session_uid: '0xabcdef1234567890',
    track_name: 'Silverstone',
    session_type: 'Qualifying 1',
    packet_format: 2026,
    created_at: '2026-07-11T14:00:00Z',
  });

  it('shows one tab bar with the story first and the three lap charts for a race', () => {
    const setActiveDetailTab = vi.fn();
    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockRaceSession}
          isRaceSession={true}
          activeDetailTab="story"
          setActiveDetailTab={setActiveDetailTab}
          totalSessionLaps={52}
          totalDriversCount={20}
        />
      </I18nProvider>
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Story',
      'Classification',
      'Pace',
      'Positions',
      'Gap to leader',
      'Tyres & stints',
      'Sectors & speed',
    ]);
    fireEvent.click(screen.getByRole('tab', { name: 'Positions' }));
    expect(setActiveDetailTab).toHaveBeenCalledWith('position');

    // Arrow keys move along the tab list and select, wrapping at the ends
    const story = screen.getByRole('tab', { name: 'Story' });
    expect(story).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(story, { key: 'ArrowLeft' });
    expect(setActiveDetailTab).toHaveBeenLastCalledWith('sectors');
    fireEvent.keyDown(story, { key: 'ArrowRight' });
    expect(setActiveDetailTab).toHaveBeenLastCalledWith('classification');
  });

  it('leaves the lap charts out for a session that is not a race', () => {
    render(
      <I18nProvider>
        <SessionDetailHeader
          session={mockQualySession}
          isRaceSession={false}
          activeDetailTab="classification"
          setActiveDetailTab={vi.fn()}
          totalSessionLaps={15}
          totalDriversCount={20}
        />
      </I18nProvider>
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Story',
      'Classification',
      'Tyres & stints',
      'Sectors & speed',
    ]);
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
