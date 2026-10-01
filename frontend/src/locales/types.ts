import type { en } from './en';

/** Every dictionary has the English one's shape, so tsc reports a missing or extra key. */
export type LocaleDictionary = typeof en;
