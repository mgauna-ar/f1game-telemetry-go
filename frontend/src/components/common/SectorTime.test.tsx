import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectorTime } from './SectorTime';

describe('SectorTime', () => {
  it('renders an ordinary time without a colour or a label', () => {
    render(<SectorTime>28.410</SectorTime>);
    const time = screen.getByText('28.410');
    expect(time).not.toHaveClass('sector-purple');
    expect(time).not.toHaveClass('sector-green');
    expect(time).not.toHaveAttribute('title');
  });

  it('says a purple time is the session best, in a tooltip and to screen readers', () => {
    render(<SectorTime isSessionBest isPersonalBest>28.410</SectorTime>);
    const time = screen.getByTitle('Session Fastest Sector');
    expect(time).toHaveClass('sector-purple');
    expect(time).toHaveTextContent('28.410 (Session Fastest Sector)');
  });

  it('says a green time is a personal best', () => {
    render(<SectorTime isPersonalBest>28.410</SectorTime>);
    const time = screen.getByTitle('Personal Best Sector');
    expect(time).toHaveClass('sector-green');
    expect(time).toHaveTextContent('28.410 (Personal Best Sector)');
  });
});
