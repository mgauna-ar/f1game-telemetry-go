import { render, screen, fireEvent, within, act } from '@testing-library/react';
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

/** The three views in the main navigation, in order. */
const navItems = () => within(screen.getByRole('navigation', { name: 'Main Navigation' })).getAllByRole('link');
const navItem = (name: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('link', { name });

/** Opens a URL the way a bookmark or a typed address would. */
const openAt = (url: string) => window.history.replaceState(null, '', url);

describe('App Navigation and Tab Bar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders reordered navigation tabs in exact order: 1) Session History, 2) Lap Comparator, 3) Live Session', () => {
    render(<App />);

    const tabs = navItems();
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

    const tabs = navItems();
    expect(tabs[0]).toHaveAttribute('aria-current', 'page');
    expect(tabs[1]).not.toHaveAttribute('aria-current');
    expect(tabs[2]).not.toHaveAttribute('aria-current');
    expect(window.location.pathname).toBe('/history');
  });

  it('switches to Lap Comparator when clicked and persists to localStorage', async () => {
    render(<App />);

    const comparatorTab = navItem(/Lap Comparator/i);
    fireEvent.click(comparatorTab);

    expect(await screen.findByTestId('lap-comparator-view')).toBeInTheDocument();
    expect(screen.queryByTestId('session-history-view')).not.toBeInTheDocument();
    expect(comparatorTab).toHaveAttribute('aria-current', 'page');
    expect(window.location.pathname).toBe('/compare');
    expect(localStorage.getItem('f1_active_tab')).toBe('comparator');
  });

  it('switches to Live Session when clicked and persists to localStorage', async () => {
    render(<App />);

    const liveTab = navItem(/Live Session/i);
    fireEvent.click(liveTab);

    expect(await screen.findByTestId('dashboard-view')).toBeInTheDocument();
    expect(screen.queryByTestId('session-history-view')).not.toBeInTheDocument();
    expect(liveTab).toHaveAttribute('aria-current', 'page');
    expect(window.location.pathname).toBe('/live/dashboard');
    expect(localStorage.getItem('f1_active_tab')).toBe('live');
  });

  it('opens the page a URL names', async () => {
    openAt('/live/cockpit');
    render(<App />);

    expect(await screen.findByTestId('dashboard-view')).toBeInTheDocument();
    expect(navItem(/Live Session/i)).toHaveAttribute('aria-current', 'page');
    expect(navItem(/Live Session/i)).toHaveAttribute('href', '/live/cockpit');
  });

  it('goes back to the previous page with the browser back button', async () => {
    render(<App />);
    await screen.findByTestId('session-history-view');

    fireEvent.click(navItem(/Live Session/i));
    expect(await screen.findByTestId('dashboard-view')).toBeInTheDocument();

    act(() => {
      window.history.back();
    });
    expect(await screen.findByTestId('session-history-view')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/history');
  });

  it('shows an unknown address as the session list', async () => {
    openAt('/nowhere?x=1');
    render(<App />);

    expect(await screen.findByTestId('session-history-view')).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/history');
  });

  it('restores saved tab from localStorage on mount', async () => {
    localStorage.setItem('f1_active_tab', 'comparator');
    render(<App />);

    expect(await screen.findByTestId('lap-comparator-view')).toBeInTheDocument();
    const tabs = navItems();
    expect(tabs[1]).toHaveAttribute('aria-current', 'page');
  });

  it('renders active version badge in navigation header', async () => {
    render(<App />);

    const versionBadge = await screen.findByTestId('nav-version-badge');
    expect(versionBadge).toBeInTheDocument();
  });
});
