import { describe, it, expect } from 'vitest';
import { buildChatContextRequest, resolveRadioLanguage } from './chatContext';

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
