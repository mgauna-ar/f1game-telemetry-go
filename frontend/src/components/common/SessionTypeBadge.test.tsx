import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionTypeBadge } from './SessionTypeBadge';

describe('SessionTypeBadge Component', () => {
  it('renders qualifying session with purple badge and timer icon', () => {
    render(<SessionTypeBadge sessionType="Short Qualifying" />);
    const badge = screen.getByText('Short Qualifying');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('.session-badge');
    expect(container).toHaveClass('badge-purple');
  });

  it('renders race session with red badge', () => {
    render(<SessionTypeBadge sessionType="Race" />);
    const badge = screen.getByText('Race');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('.session-badge');
    expect(container).toHaveClass('badge-red');
  });

  it('renders practice session with green badge', () => {
    render(<SessionTypeBadge sessionType="Practice 1" />);
    const badge = screen.getByText('Practice 1');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('.session-badge');
    expect(container).toHaveClass('badge-green');
  });

  it('renders sprint session with orange badge', () => {
    render(<SessionTypeBadge sessionType="Sprint" />);
    const badge = screen.getByText('Sprint');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('.session-badge');
    expect(container).toHaveClass('badge-orange');
  });

  it('renders unknown fallback when sessionType is undefined', () => {
    render(<SessionTypeBadge />);
    const badge = screen.getByText('Unknown');
    expect(badge).toBeInTheDocument();
    const container = badge.closest('.session-badge');
    expect(container).toHaveClass('badge-gray');
  });
});
