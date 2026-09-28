import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { SESSION_PAGE_SIZE, type SessionListPaging } from '../../hooks/useSessionListPaging';
import { Button } from '../ui/Button';
import styles from './SessionListMore.module.css';

/** "Showing 50 of 120 sessions" and a button for the next page, when there is one. */
export const SessionListMore: React.FC<{ paging: SessionListPaging }> = ({ paging }) => {
  const { t } = useI18n();
  if (paging.shown >= paging.total) return null;
  return (
    <div className={styles.more}>
      <span className={styles.moreCount} aria-live="polite">
        {t('history.list.showing', { shown: paging.shown, total: paging.total })}
      </span>
      <Button size="sm" onClick={paging.showMore}>
        {t('history.list.showMore', { count: Math.min(SESSION_PAGE_SIZE, paging.total - paging.shown) })}
      </Button>
    </div>
  );
};
