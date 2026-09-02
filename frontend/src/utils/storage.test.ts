import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from './storage';

describe('storage utility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('retrieves fallback when key does not exist', () => {
    expect(storage.get('f1_active_tab', 'history')).toBe('history');
    expect(storage.get('f1_ai_open', false)).toBe(false);
    expect(storage.get('f1_ai_engineer_config', { provider: 'gemini' })).toEqual({ provider: 'gemini' });
  });

  it('stores and retrieves JSON object values correctly', () => {
    const config = { provider: 'openai', model: 'gpt-4o' };
    storage.set('f1_ai_engineer_config', config);
    expect(storage.get('f1_ai_engineer_config', { provider: 'gemini', model: 'default' })).toEqual(config);
  });

  it('stores and retrieves raw string values cleanly', () => {
    storage.set('f1_active_tab', 'comparator');
    expect(storage.get('f1_active_tab', 'history')).toBe('comparator');
  });

  it('handles corrupted JSON gracefully and returns fallback', () => {
    localStorage.setItem('f1_ai_engineer_config', '{corrupted_json:');
    const fallback = { provider: 'gemini' };
    expect(storage.get('f1_ai_engineer_config', fallback)).toEqual(fallback);
  });

  it('parses boolean strings if fallback is boolean', () => {
    localStorage.setItem('f1_ai_open', 'true');
    expect(storage.get('f1_ai_open', false)).toBe(true);

    localStorage.setItem('f1_ai_open', 'false');
    expect(storage.get('f1_ai_open', true)).toBe(false);
  });

  it('parses numeric strings if fallback is number', () => {
    localStorage.setItem('f1_radio_volume', '0.75');
    expect(storage.get('f1_radio_volume', 1)).toBe(0.75);
  });

  it('removes keys cleanly', () => {
    storage.set('f1_active_tab', 'live');
    expect(storage.get('f1_active_tab', 'history')).toBe('live');
    storage.remove('f1_active_tab');
    expect(storage.get('f1_active_tab', 'history')).toBe('history');
  });

  it('handles window.localStorage exceptions gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Access is denied for this document');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => storage.get('f1_active_tab', 'fallback')).not.toThrow();
    expect(storage.get('f1_active_tab', 'fallback')).toBe('fallback');
    expect(() => storage.set('f1_active_tab', 'value')).not.toThrow();
    expect(() => storage.remove('f1_active_tab')).not.toThrow();
  });
});
