import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { navigate, openComparator, useRoute, useUrl } from './router';
import { Link } from './Link';

describe('router', () => {
  it('re-renders readers when the URL changes, and on back', async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toMatchObject({ page: 'history' });

    act(() => navigate('/live/cockpit'));
    expect(result.current).toEqual({ page: 'live', mode: 'cockpit' });
    expect(window.location.pathname).toBe('/live/cockpit');

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(result.current).toMatchObject({ page: 'history' });
  });

  it('adds a history entry, or replaces the current one', () => {
    act(() => navigate('/history/3'));
    act(() => navigate('/history/4'));
    const entries = window.history.length;
    act(() => navigate('/history/4/charts', { replace: true }));
    expect(window.history.length).toBe(entries);
    expect(window.location.pathname).toBe('/history/4/charts');
    // The same URL again adds nothing
    act(() => navigate('/history/4/charts'));
    expect(window.history.length).toBe(entries);
    act(() => navigate('/history/5'));
    expect(window.history.length).toBe(entries + 1);
  });

  it('opens the comparator with the given laps', () => {
    const { result } = renderHook(() => useUrl());
    act(() => openComparator({ sessionB: 4, lapB: 40 }));
    expect(result.current).toBe('/compare?sb=4&b=40');
  });
});

describe('Link', () => {
  it('opens its page without reloading on a plain click', () => {
    render(<Link href="/live/dashboard">Live</Link>);
    const link = screen.getByRole('link', { name: 'Live' });
    expect(link).toHaveAttribute('href', '/live/dashboard');

    const notPrevented = fireEvent.click(link);
    expect(notPrevented).toBe(false);
    expect(window.location.pathname).toBe('/live/dashboard');
  });

  it('leaves modified and middle clicks to the browser, for a new tab', () => {
    render(<Link href="/live/dashboard">Live</Link>);
    const link = screen.getByRole('link', { name: 'Live' });

    // After the link's own handler: stop jsdom from following the link itself
    const stopDefault = (event: Event) => event.preventDefault();
    document.addEventListener('click', stopDefault);
    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { shiftKey: true });
    fireEvent.click(link, { button: 1 });
    document.removeEventListener('click', stopDefault);
    expect(window.location.pathname).toBe('/');
  });
});
