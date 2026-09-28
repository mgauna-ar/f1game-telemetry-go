import React, { useEffect, useId, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import { storage } from '../../../utils/storage';
import { Button } from '../../ui/Button';
import styles from './OldDriverNameNotice.module.css';

/** The driver name the Lap Comparator used to save, which found "you" in sessions without a car. */
const OLD_DRIVER_NAME_KEY = 'f1_comparator_default_driver_name';

/**
 * Shown once when the old saved driver name is still in this browser: offers to make that driver
 * yours in every session without a driver. Applying or dismissing it removes the name for good.
 */
export const OldDriverNameNotice: React.FC = () => {
  const { t } = useI18n();
  const titleId = useId();
  const [name, setName] = useState(() => {
    const saved = storage.get<unknown>(OLD_DRIVER_NAME_KEY, '');
    return typeof saved === 'string' || typeof saved === 'number' ? String(saved).trim() : '';
  });
  const [applying, setApplying] = useState(false);
  const loaded = useSessionListStore((s) => s.lastFetchedAt !== null || s.sessions.length > 0);
  const sessions = useSessionListStore((s) => s.sessions);
  const withoutDriver = sessions.filter((s) => s.player_car_index === null).map((s) => s.id);

  const forget = () => {
    storage.remove(OLD_DRIVER_NAME_KEY);
    setName('');
  };

  // Nothing to apply it to: drop it without asking
  const nothingToDo = name !== '' && loaded && withoutDriver.length === 0;
  useEffect(() => {
    if (!nothingToDo) return;
    storage.remove(OLD_DRIVER_NAME_KEY);
    setName('');
  }, [nothingToDo]);

  if (!name || !loaded || withoutDriver.length === 0) return null;

  const apply = async () => {
    setApplying(true);
    try {
      const result = await useSessionListStore.getState().setPlayerByName(withoutDriver, name);
      const parts = [t('history.player.notice.updated', { count: result.updated.length })];
      if (result.not_found.length > 0) {
        parts.push(t('history.player.notice.notFound', { count: result.not_found.length }));
      }
      if (result.ambiguous.length > 0) {
        parts.push(t('history.player.notice.ambiguous', { count: result.ambiguous.length }));
      }
      useToastStore.getState().showToast({
        type: result.updated.length > 0 ? 'success' : 'info',
        message: `${t('history.player.notice.applied', { name })} ${parts.join(' · ')}`,
      });
      forget();
    } catch (err: unknown) {
      useToastStore.getState().showToast({
        type: 'error',
        message: t('history.player.picker.saveError', { message: err instanceof Error ? err.message : String(err) }),
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className={styles.notice} aria-labelledby={titleId}>
      <span className={styles.icon} aria-hidden="true">
        <UserRound size={18} />
      </span>
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {t('history.player.notice.title', { name, count: withoutDriver.length })}
        </h2>
        <p className={styles.body}>{t('history.player.notice.body')}</p>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={forget} disabled={applying}>
          {t('history.player.notice.dismiss')}
        </Button>
        <Button variant="primary" onClick={apply} loading={applying}>
          {t('history.player.notice.apply')}
        </Button>
      </div>
    </section>
  );
};
