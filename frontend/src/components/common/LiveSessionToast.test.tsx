import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { LiveSessionToast } from './LiveSessionToast';
import { ToastContainer } from './ToastContainer';
import { useToastStore } from '../../store/useToastStore';
import { useSystemStatusStore } from '../../store/useSystemStatusStore';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import type { ActiveSession } from '../../types/system';

// Melbourne (TrackId 0), Race (15)
const session: ActiveSession = {
  session_uid: '0x0A',
  session_type: 15,
  track_id: 0,
  packet_format: 2025,
  player_car_index: 0,
};

const renderToast = () =>
  render(
    <>
      <LiveSessionToast />
      <ToastContainer />
    </>
  );

describe('LiveSessionToast', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
    useSystemStatusStore.setState({ liveStatus: 'listening', session: null });
    useSessionStatusStore.setState({ session: null });
    window.history.replaceState(null, '', '/history');
  });

  it('announces a live session once and opens the Live tab', () => {
    renderToast();
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();

    act(() => useSystemStatusStore.setState({ liveStatus: 'live', session }));
    expect(screen.getByText(/Live session detected: Race at Melbourne/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(window.location.pathname).toMatch(/^\/live\//);
    expect(screen.queryByText(/Live session detected/)).toBeNull();
  });

  it('does not announce the same session again, nor one already seen on the Live tab', () => {
    renderToast();
    act(() => useSystemStatusStore.setState({ liveStatus: 'live', session }));
    act(() => useToastStore.getState().clearToasts());
    act(() => useSystemStatusStore.setState({ liveStatus: 'stale', session }));
    act(() => useSystemStatusStore.setState({ liveStatus: 'live', session }));
    expect(screen.queryByText(/Live session detected/)).toBeNull();

    act(() => useSessionStatusStore.setState({ session: { SessionUID: '0x0B' } as never }));
    act(() => useSystemStatusStore.setState({ liveStatus: 'live', session: { ...session, session_uid: '0x0B' } }));
    expect(screen.queryByText(/Live session detected/)).toBeNull();
  });

  it('stays quiet on the Live tab', () => {
    window.history.replaceState(null, '', '/live/dashboard');
    renderToast();
    act(() => useSystemStatusStore.setState({ liveStatus: 'live', session }));
    expect(screen.queryByText(/Live session detected/)).toBeNull();
  });
});
