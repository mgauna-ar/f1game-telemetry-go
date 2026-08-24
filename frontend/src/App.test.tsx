import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// Mock child components to isolate App tab navigation testing
vi.mock('./components/SessionHistory', () => ({
  SessionHistory: () => <div data-testid="session-history-view">Session History View</div>,
}));

vi.mock('./components/LapComparator', () => ({
  LapComparator: () => <div data-testid="lap-comparator-view">Lap Comparator View</div>,
}));

vi.mock('./components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-view">Live Dashboard View</div>,
}));

describe('App Navigation and Tab Bar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders reordered navigation tabs in exact order: 1) Session History, 2) Lap Comparator, 3) Live Session', () => {
    render(<App />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent(/Session History/i);
    expect(tabs[1]).toHaveTextContent(/Lap Comparator/i);
    expect(tabs[2]).toHaveTextContent(/Live Session/i);
  });

  it('defaults to Session History on initial launch', async () => {
    render(<App />);

    expect(await screen.findByTestId('session-history-view')).toBeInTheDocument();
    expect(screen.queryByTestId('lap-comparator-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-view')).not.toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveClass('active');
    expect(tabs[1]).not.toHaveClass('active');
    expect(tabs[2]).not.toHaveClass('active');
  });

  it('switches to Lap Comparator when clicked and persists to localStorage', async () => {
    render(<App />);

    const comparatorTab = screen.getByRole('tab', { name: /Lap Comparator/i });
    fireEvent.click(comparatorTab);

    expect(await screen.findByTestId('lap-comparator-view')).toBeInTheDocument();
    expect(screen.queryByTestId('session-history-view')).not.toBeInTheDocument();
    expect(comparatorTab).toHaveClass('active');
    expect(localStorage.getItem('f1_active_tab')).toBe('comparator');
  });

  it('switches to Live Session when clicked and persists to localStorage', async () => {
    render(<App />);

    const liveTab = screen.getByRole('tab', { name: /Live Session/i });
    fireEvent.click(liveTab);

    expect(await screen.findByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.queryByTestId('session-history-view')).not.toBeInTheDocument();
    expect(liveTab).toHaveClass('active');
    expect(localStorage.getItem('f1_active_tab')).toBe('live');
  });

  it('restores saved tab from localStorage on mount', async () => {
    localStorage.setItem('f1_active_tab', 'comparator');
    render(<App />);

    expect(await screen.findByTestId('lap-comparator-view')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[1]).toHaveClass('active');
  });

  it('renders active version badge in navigation header', async () => {
    render(<App />);

    const versionBadge = await screen.findByTestId('nav-version-badge');
    expect(versionBadge).toBeInTheDocument();
  });
});
