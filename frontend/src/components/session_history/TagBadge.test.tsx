import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagBadge } from './TagBadge';
import type { Tag } from '../../types/session';

describe('TagBadge', () => {
  const mockTag: Tag = {
    id: 1,
    name: 'WOR Tier 1',
    color: '#ef4444',
  };

  it('renders tag name and color indicator', () => {
    render(<TagBadge tag={mockTag} />);
    expect(screen.getByText('WOR Tier 1')).toBeInTheDocument();
  });

  it('calls onClick when badge is clicked', () => {
    const handleClick = vi.fn();
    render(<TagBadge tag={mockTag} onClick={handleClick} />);
    const badge = screen.getByText('WOR Tier 1');
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders onRemove button and triggers handler', () => {
    const handleRemove = vi.fn();
    render(<TagBadge tag={mockTag} onRemove={handleRemove} />);
    const removeBtn = screen.getByRole('button', { name: /remove tag wor tier 1/i });
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });
});
