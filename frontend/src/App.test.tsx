import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { usePerformanceModeStore } from './store/usePerformanceModeStore';
import { navigate } from './router/router';

// Mock child components to isolate App tab navigation testing
vi.mock('./components/SessionHistory', () => ({
  SessionHistory: () => <div data-testid="session-history-view">Session History View</div>,
}));

vi.mock('./components/LapComparator', () => ({
  LapComparator: () => <div data-testid="lap-comparator-view">Lap Comparator View</div>,
}));

vi.mock('./components/progress/TrackProgress', () => ({
  TrackProgress: () => <div data-testid="progress-view">Progress View</div>,
}));

vi.mock('./components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-view">Live Dashboard View</div>,
}));

/** The four views in the main navigation, in order. */
const navItems = () => within(screen.getByRole('navigation', { name: 'Main Navigation' })).getAllByRole('link');
const navItem = (name: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Main Navigation' })).getByRole('link', { name });

/** Opens a URL the way a bookmark or a typed address would. */
const openAt = (url: string) => window.history.replaceState(null, '', url);

describe('App Navigation and Tab Bar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the navigation tabs in order: Session History, Lap Comparator, Progress, Live Session', () => {
    render(<App />);

    const tabs = navItems();
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent(/Session History/i);
    expect(tabs[1]).toHaveTextContent(/Lap Comparator/i);
    expect(tabs[2]).toHaveTextContent(/Progress/i);
    expect(tabs[3]).toHaveTextContent(/Live Session/i);
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
    expect(tabs[3]).not.toHaveAttribute('aria-current');
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

  it('opens Progress at a track, and its tab goes back to that track', async () => {
    openAt('/progress/Abu%20Dhabi');
    render(<App />);

    expect(await screen.findByTestId('progress-view')).toBeInTheDocument();
    expect(localStorage.getItem('f1_active_tab')).toBe('progress');

    fireEvent.click(navItem(/Session History/i));
    expect(await screen.findByTestId('session-history-view')).toBeInTheDocument();
    expect(navItem(/Progress/i)).toHaveAttribute('href', '/progress/Abu%20Dhabi');
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

describe('Performance mode', () => {
  beforeEach(() => {
    localStorage.clear();
    usePerformanceModeStore.setState({ enabled: { driver: true, general: false } });
  });

  const root = () => document.documentElement;
  const toggle = () => screen.getByTestId('performance-mode-toggle');

  it('is off on the dashboard and on in the Driver view by default', async () => {
    openAt('/live/dashboard');
    const { unmount } = render(<App />);
    await screen.findByTestId('dashboard-view');
    expect(root()).not.toHaveAttribute('data-performance');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    unmount();

    openAt('/live/driver');
    render(<App />);
    await screen.findByTestId('dashboard-view');
    expect(root()).toHaveAttribute('data-performance', 'on');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the Driver view and the other pages apart', async () => {
    openAt('/history');
    render(<App />);
    await screen.findByTestId('session-history-view');

    fireEvent.click(toggle());
    expect(root()).toHaveAttribute('data-performance', 'on');
    expect(localStorage.getItem('f1_performance_mode')).toBe('true');

    // Turning it off in the Driver view leaves the other pages on
    act(() => navigate('/live/driver'));
    await screen.findByTestId('dashboard-view');
    fireEvent.click(toggle());
    expect(root()).not.toHaveAttribute('data-performance');
    expect(localStorage.getItem('f1_performance_mode_driver')).toBe('false');

    act(() => window.history.back());
    await screen.findByTestId('session-history-view');
    expect(root()).toHaveAttribute('data-performance', 'on');
  });
});
