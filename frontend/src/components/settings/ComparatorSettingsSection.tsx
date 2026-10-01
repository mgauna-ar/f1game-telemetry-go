import React from 'react';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { ComparatorPreferencesFields } from '../lap_comparator/ComparatorPreferencesFields';

/** Who the comparator's slot B picks by default; each change is saved for every device. */
export const ComparatorSettingsSection: React.FC = () => {
  const preferences = useComparatorPreferencesStore((s) => s.preferences);
  const update = useComparatorPreferencesStore((s) => s.update);
  return <ComparatorPreferencesFields value={preferences} onChange={update} />;
};
