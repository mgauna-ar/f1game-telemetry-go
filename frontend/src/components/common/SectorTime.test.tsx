import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectorTime } from './SectorTime';

describe('SectorTime', () => {
  it('renders an ordinary time without a colour or a label', () => {
    render(<SectorTime>28.410</SectorTime>);
    const time = screen.getByText('28.410');
    expect(time).not.toHaveAttribute('data-best');
    expect(time).not.toHaveAttribute('title');
  });

  it('says a purple time is the session best, in a tooltip and to screen readers', () => {
    render(<SectorTime isSessionBest isPersonalBest>28.410</SectorTime>);
    const time = screen.getByTitle('Session Fastest Sector');
    expect(time).toHaveAttribute('data-best', 'session');
    expect(time).toHaveTextContent('28.410 (Session Fastest Sector)');
  });

  it('says a green time is a personal best', () => {
    render(<SectorTime isPersonalBest>28.410</SectorTime>);
    const time = screen.getByTitle('Personal Best Sector');
    expect(time).toHaveAttribute('data-best', 'personal');
    expect(time).toHaveTextContent('28.410 (Personal Best Sector)');
  });
});
