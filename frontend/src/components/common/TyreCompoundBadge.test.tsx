import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TyreCompoundBadge } from './TyreCompoundBadge';

describe('TyreCompoundBadge Component', () => {
  it('renders intermediate compound as "I" with green styling for all intermediate string variants', () => {
    const { rerender } = render(<TyreCompoundBadge compound="INTERMEDIATE" />);
    expect(screen.getByText('I')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="INTERMEDIUM" />);
    expect(screen.getByText('I')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="INTER" />);
    expect(screen.getByText('I')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="I" />);
    expect(screen.getByText('I')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="7" />);
    expect(screen.getByText('I')).toBeInTheDocument();
  });

  it('renders medium compound as "M" with yellow styling', () => {
    const { rerender } = render(<TyreCompoundBadge compound="MEDIUM" />);
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="MED" />);
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="M" />);
    expect(screen.getByText('M')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="17" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders soft, hard, and wet compounds accurately', () => {
    const { rerender } = render(<TyreCompoundBadge compound="SOFT" />);
    expect(screen.getByText('S')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="HARD" />);
    expect(screen.getByText('H')).toBeInTheDocument();

    rerender(<TyreCompoundBadge compound="WET" />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('renders null when compound is undefined', () => {
    const { container } = render(<TyreCompoundBadge compound={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
