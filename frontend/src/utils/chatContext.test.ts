import { describe, it, expect } from 'vitest';
import { buildChatContextRequest, chatTargetsFromRoute, resolveRadioLanguage } from './chatContext';
import { parseRoute } from '../router/routes';

describe('buildChatContextRequest', () => {
  const comparator = { lapAId: 11, lapBId: 12, zoom: null, trackName: 'Monza' };
  const debrief = { sessionId: 7, trackName: 'Suzuka' };

  it('sends only the session ID for a debrief', () => {
    expect(buildChatContextRequest('session_debrief', comparator, debrief)).toEqual({
      context_mode: 'session_debrief',
      session_id: 7,
    });
  });

  it('falls back to a general chat when the debrief session is not loaded', () => {
    expect(buildChatContextRequest('session_debrief', null, null)).toEqual({ context_mode: 'general' });
  });

  it('sends the lap IDs, and the zoom only when it is a real range', () => {
    expect(buildChatContextRequest('comparator', comparator, null)).toEqual({
      context_mode: 'comparator',
      lap_a_id: 11,
      lap_b_id: 12,
    });
    expect(buildChatContextRequest('comparator', { ...comparator, zoom: [1200, 1600] }, null)).toEqual({
      context_mode: 'comparator',
      lap_a_id: 11,
      lap_b_id: 12,
      zoom: { start_meters: 1200, end_meters: 1600 },
    });
    expect(buildChatContextRequest('comparator', { ...comparator, zoom: [500, 500] }, null)).not.toHaveProperty('zoom');
  });

  it('keeps comparator mode without laps so the engineer knows none are picked', () => {
    expect(buildChatContextRequest('comparator', null, null)).toEqual({ context_mode: 'comparator' });
  });

  it('sends no data for live and general chats', () => {
    expect(buildChatContextRequest('live', comparator, debrief)).toEqual({ context_mode: 'live' });
    expect(buildChatContextRequest('general', comparator, debrief)).toEqual({ context_mode: 'general' });
  });
});

describe('resolveRadioLanguage', () => {
  it('follows the UI language on auto', () => {
    expect(resolveRadioLanguage('auto', 'es')).toBe('es');
    expect(resolveRadioLanguage('auto', 'en')).toBe('en');
  });

  it('uses the chosen radio language otherwise', () => {
    expect(resolveRadioLanguage('es', 'en')).toBe('es');
    expect(resolveRadioLanguage('en', 'es')).toBe('en');
  });
});

describe('chatTargetsFromRoute', () => {
  const sessions = [
    { id: 3, track_name: 'Monza' },
    { id: 7, track_name: 'Suzuka' },
  ];
  const targetsAt = (url: string) => {
    const { pathname, search } = new URL(url, 'http://localhost');
    return chatTargetsFromRoute(parseRoute(pathname, search), sessions);
  };

  it('debriefs the session open in History', () => {
    expect(targetsAt('/history/7/charts')).toEqual({
      contextMode: 'session_debrief',
      comparatorTarget: null,
      sessionDebriefTarget: { sessionId: 7, trackName: 'Suzuka' },
    });
    expect(targetsAt('/history').contextMode).toBe('general');
    expect(targetsAt('/progress/Monza').contextMode).toBe('general');
  });

  it('compares the laps and zoom in the comparator URL', () => {
    expect(targetsAt('/compare?sa=3&a=41&b=42&zoom=100-400')).toEqual({
      contextMode: 'comparator',
      comparatorTarget: { lapAId: 41, lapBId: 42, zoom: [100, 400], trackName: 'Monza' },
      sessionDebriefTarget: null,
    });
    // Until both laps are picked there is nothing to compare yet
    expect(targetsAt('/compare?sa=3&a=41')).toMatchObject({ contextMode: 'comparator', comparatorTarget: null });
  });

  it('briefs the live session on the live pages', () => {
    expect(targetsAt('/live/cockpit')).toEqual({
      contextMode: 'live',
      comparatorTarget: null,
      sessionDebriefTarget: null,
    });
  });
});
