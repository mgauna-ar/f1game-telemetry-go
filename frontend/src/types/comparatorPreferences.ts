export type ComparatorRivalMode = 'fastest' | 'teammate' | 'driver';

export interface ComparatorPreferences {
  rivalMode: ComparatorRivalMode;
  rivalDriverName: string;
}
