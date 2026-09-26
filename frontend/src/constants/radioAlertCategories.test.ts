import { describe, it, expect } from 'vitest';
import radioAlertCategories from './radioAlertCategories.json';
import { radio_phrases as enPhrases } from '../locales/en/radio_phrases';
import { radio_phrases as esPhrases } from '../locales/es/radio_phrases';

describe('radioAlertCategories', () => {
  const entries = Object.entries(radioAlertCategories as Record<string, string | null>);

  it.each([
    ['en', enPhrases],
    ['es', esPhrases],
  ])('maps every alert to a phrase category that exists in %s, or to null', (_locale, phrases) => {
    const missing = entries.filter(([, category]) => category !== null && !(category in phrases));
    expect(missing).toEqual([]);
  });
});
