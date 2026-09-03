export type ComparatorRivalMode = 'fastest' | 'teammate' | 'driver';

export interface ComparatorPreferences {
  defaultDriverName: string;
  rivalMode: ComparatorRivalMode;
  rivalDriverName: string;
}
