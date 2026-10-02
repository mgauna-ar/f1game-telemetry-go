import type { LocaleDictionary } from '../types';
import { common } from './common';
import { nav } from './nav';
import { history } from './history';
import { comparator } from './comparator';
import { live } from './live';
import { progress } from './progress';
import { ai_engineer } from './ai_engineer';
import { settings } from './settings';
import { desktop } from './desktop';

/** The Spanish dictionary, loaded only when Spanish is the language on screen. */
export const es: LocaleDictionary = {
  common,
  nav,
  history,
  comparator,
  progress,
  live,
  ai_engineer,
  settings,
  desktop,
};
