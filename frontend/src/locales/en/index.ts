import { common } from './common';
import { nav } from './nav';
import { history } from './history';
import { comparator } from './comparator';
import { live } from './live';
import { progress } from './progress';
import { ai_engineer } from './ai_engineer';
import { settings } from './settings';
import { desktop } from './desktop';

/**
 * The English dictionary: the base every other language matches key for key, and the fallback.
 * The radio's spoken calls are not here; they load with the Live tab (`utils/radioPhrases.ts`).
 */
export const en = {
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
