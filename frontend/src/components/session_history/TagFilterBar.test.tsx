import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagFilterBar } from './TagFilterBar';
import { I18nProvider } from '../../context/I18nProvider';
import type { Tag } from '../../types/session';
import { makeTag } from '../../test/wireFactories';

describe('TagFilterBar', () => {
  const mockTags: Tag[] = [
    makeTag({ id: 1, name: 'WOR League', color: '#ef4444' }),
    makeTag({ id: 2, name: 'Setup Test', color: '#10b981' }),
  ];
  const countByTag = { 1: 5, 2: 2 };

  it('renders all tag pills with count badges', () => {
    render(
      <I18nProvider>
        <TagFilterBar
          availableTags={mockTags}
          selectedTagId={null}
          onSelectTag={vi.fn()}
          sessionCountByTag={countByTag}
          totalSessionsCount={10}
        />
      </I18nProvider>
    );

    expect(screen.getByText('All Tags')).toBeInTheDocument();
    expect(screen.getByText('WOR League')).toBeInTheDocument();
    expect(screen.getByText('Setup Test')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('triggers onSelectTag when a tag pill is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <I18nProvider>
        <TagFilterBar
          availableTags={mockTags}
          selectedTagId={null}
          onSelectTag={handleSelect}
          sessionCountByTag={countByTag}
          totalSessionsCount={10}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('WOR League'));
    expect(handleSelect).toHaveBeenCalledWith(1);
  });

  it('unselects tag when clicked while active', () => {
    const handleSelect = vi.fn();
    render(
      <I18nProvider>
        <TagFilterBar
          availableTags={mockTags}
          selectedTagId={1}
          onSelectTag={handleSelect}
          sessionCountByTag={countByTag}
          totalSessionsCount={10}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByText('WOR League'));
    expect(handleSelect).toHaveBeenCalledWith(null);
  });
});
