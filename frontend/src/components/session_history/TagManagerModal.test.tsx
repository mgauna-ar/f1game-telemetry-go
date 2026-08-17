import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagManagerModal } from './TagManagerModal';
import { I18nProvider } from '../../context/I18nProvider';
import type { Session, Tag } from '../../types/session';

describe('TagManagerModal', () => {
  const availableTags: Tag[] = [
    { id: 1, name: 'WOR Tier 1', color: '#ef4444' },
    { id: 2, name: 'Time Trial', color: '#06b6d4' },
  ];
  const mockSession: Session = {
    id: 10,
    session_uid: '12345',
    track_name: 'Montreal',
    session_type: 'RACE',
    weather: 'Clear',
    created_at: new Date().toISOString(),
    tags: [{ id: 1, name: 'WOR Tier 1', color: '#ef4444' }],
  };

  it('renders available tags and marks assigned ones when open', () => {
    render(
      <I18nProvider>
        <TagManagerModal
          session={mockSession}
          availableTags={availableTags}
          onAddTag={vi.fn()}
          onRemoveTag={vi.fn()}
          isOpen={true}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/WOR Tier 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Time Trial/i)).toBeInTheDocument();
    expect(screen.getByText(/Assigned/i)).toBeInTheDocument();
  });

  it('toggles adding unassigned tag', async () => {
    const handleAddTag = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <TagManagerModal
          session={mockSession}
          availableTags={availableTags}
          onAddTag={handleAddTag}
          onRemoveTag={vi.fn()}
          isOpen={true}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('Time Trial'));
    await waitFor(() => {
      expect(handleAddTag).toHaveBeenCalledWith(10, 2);
    });
  });

  it('toggles removing assigned tag', async () => {
    const handleRemoveTag = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <TagManagerModal
          session={mockSession}
          availableTags={availableTags}
          onAddTag={vi.fn()}
          onRemoveTag={handleRemoveTag}
          isOpen={true}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('WOR Tier 1'));
    await waitFor(() => {
      expect(handleRemoveTag).toHaveBeenCalledWith(10, 1);
    });
  });

  it('allows creating a new tag with custom name and color', async () => {
    const handleAddTag = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider>
        <TagManagerModal
          session={mockSession}
          availableTags={availableTags}
          onAddTag={handleAddTag}
          onRemoveTag={vi.fn()}
          isOpen={true}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const input = screen.getByPlaceholderText('Tag or league name...');
    fireEvent.change(input, { target: { value: 'AOR Tier 3' } });
    fireEvent.click(screen.getByRole('button', { name: /create tag/i }));

    await waitFor(() => {
      expect(handleAddTag).toHaveBeenCalledWith(10, undefined, expect.objectContaining({
        name: 'AOR Tier 3',
      }));
    });
  });
});
