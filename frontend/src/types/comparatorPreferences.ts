import type { ComparatorRivalMode } from './settings';

export type { ComparatorRivalMode };

/** Who the comparator's slot B picks by default, shared by every device (`/api/settings/comparator`). */
export interface ComparatorPreferences {
  rivalMode: ComparatorRivalMode;
  rivalDriverName: string;
}
