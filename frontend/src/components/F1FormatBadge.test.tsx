import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { F1FormatBadge } from './F1FormatBadge';

describe('F1FormatBadge', () => {
  it('renders F1 2026 by default when format is 2026 or undefined', () => {
    const { rerender } = render(<F1FormatBadge format={2026} />);
    expect(screen.getByText('F1 2026')).toBeInTheDocument();
    expect(screen.getByText('F1 2026')).toHaveClass('badge-f1-2026');

    rerender(<F1FormatBadge />);
    expect(screen.getByText('F1 2026')).toBeInTheDocument();
  });

  it('renders F1 2025 when format is 2025', () => {
    render(<F1FormatBadge format={2025} />);
    expect(screen.getByText('F1 2025')).toBeInTheDocument();
    expect(screen.getByText('F1 2025')).toHaveClass('badge-f1-2025');
  });

  it('applies custom size and class names', () => {
    const { container } = render(<F1FormatBadge format={2026} size="xs" className="custom-class" />);
    const badge = container.querySelector('.custom-class');
    expect(badge).toBeInTheDocument();
  });
});
