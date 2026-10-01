import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { useComparatorPreferencesStore } from '../../store/useComparatorPreferencesStore';
import { ComparatorPreferencesFields } from '../lap_comparator/ComparatorPreferencesFields';
import { SkeletonGroup, SkeletonRows } from '../ui/Skeleton';

/**
 * Who the comparator's slot B picks by default; each change is saved for every device. Until the
 * saved choice arrives it shows placeholders, so a change can't be made to the defaults and then
 * overwritten.
 */
export const ComparatorSettingsSection: React.FC = () => {
  const { t } = useI18n();
  const preferences = useComparatorPreferencesStore((s) => s.preferences);
  const loaded = useComparatorPreferencesStore((s) => s.loaded);
  const update = useComparatorPreferencesStore((s) => s.update);
  if (!loaded) {
    return (
      <SkeletonGroup label={t('common.loading')}>
        <SkeletonRows rows={3} />
      </SkeletonGroup>
    );
  }
  return <ComparatorPreferencesFields value={preferences} onChange={update} />;
};
