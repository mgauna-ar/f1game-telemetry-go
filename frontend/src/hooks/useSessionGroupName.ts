import { useI18n } from '../context/I18nContext';
import type { SessionGroup } from '../utils/sessionListView';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The group's name as plain text, for the collapse button's label. */
export function useSessionGroupName(): (group: SessionGroup) => string {
  const { t, locale } = useI18n();
  return (group) => {
    switch (group.kind) {
      case 'none':
        return '';
      case 'date': {
        const today = new Date();
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        if (sameDay(group.date, today)) return t('history.list.today');
        if (sameDay(group.date, yesterday)) return t('history.list.yesterday');
        return group.date.toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          ...(group.date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
        });
      }
      case 'track':
        return group.track || t('common.unknownTrack');
      case 'tag':
        return group.tag?.name ?? t('history.list.noTag');
    }
  };
}
