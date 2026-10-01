import { describe, it, expect } from 'vitest';
import { SESSION_TYPES } from '../constants/f1';
import { getTranslation } from '../locales';
import { matchSessionSearch } from './sessionFilterUtils';
import { sessionTypeLabel, sessionTypeLabelForCode } from './sessionTypeLabel';
import { makeSessionListItem } from '../test/wireFactories';

const es = (key: string) => getTranslation('es', key);
const en = (key: string) => getTranslation('en', key);

describe('sessionTypeLabel', () => {
  it('translates the names the server stores, whatever their case', () => {
    expect(sessionTypeLabel('Race', es)).toBe('Carrera');
    expect(sessionTypeLabel('sprint shootout 2', es)).toBe('Clasificación sprint 2');
    expect(sessionTypeLabel('One-Shot Qualifying', en)).toBe('One-Shot Qualifying');
  });

  it('keeps a name it does not know, and names a missing one', () => {
    expect(sessionTypeLabel('Feature Race', es)).toBe('Feature Race');
    expect(sessionTypeLabel('', es)).toBe('Sesión desconocida');
    expect(sessionTypeLabel(undefined, en)).toBe('Unknown session');
  });

  it('translates the live session code', () => {
    expect(sessionTypeLabelForCode(SESSION_TYPES.TIME_TRIAL, es)).toBe('Contrarreloj');
    expect(sessionTypeLabelForCode(SESSION_TYPES.UNKNOWN, en)).toBe('Unknown session');
  });

  it('lets the session search find the translated name', () => {
    const session = makeSessionListItem({ session_type: 'Race', track_name: 'Monza' });
    expect(matchSessionSearch(session, 'carrera', es)).toBe(true);
    expect(matchSessionSearch(session, 'race', es)).toBe(true);
    expect(matchSessionSearch(session, 'práctica', es)).toBe(false);
  });
});
