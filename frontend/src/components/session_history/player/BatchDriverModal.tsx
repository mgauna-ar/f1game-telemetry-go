import React, { useEffect, useId, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useI18n } from '../../../context/I18nContext';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import type { BatchPlayerResult, SessionListItem } from '../../../types/session';
import { useUnits } from '../../../hooks/useUnits';
import { getSessionLapData } from '../../../utils/sessionDataCache';
import { sessionTypeLabel } from '../../../utils/sessionTypeLabel';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { TextInput } from '../../ui/Field';
import { SkeletonChips, SkeletonGroup } from '../../ui/Skeleton';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui/Modal';
import { driverNameSuggestions, type DriverNameSuggestion } from './driverNameSuggestions';
import styles from './BatchDriverModal.module.css';

/** Suggestions come from this many of the selected sessions (the latest), so a big selection stays quick. */
const SUGGESTION_SESSIONS = 20;
/** Names shown as buttons; the rest are in the field's list. */
const SUGGESTION_BUTTONS = 8;

interface BatchDriverModalProps {
  isOpen: boolean;
  sessionIds: number[];
  onClose: () => void;
}

/** "Set my driver": makes the driver with a given name yours in every selected session. */
export const BatchDriverModal: React.FC<BatchDriverModalProps> = ({ isOpen, sessionIds, onClose }) => {
  const { t } = useI18n();
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" data-testid="batch-driver">
      <ModalHeader
        tone="accent"
        icon={<UserRound size={20} />}
        title={t('history.player.batch.title')}
        subtitle={t('history.batch.selectedCount', { count: sessionIds.length })}
      />
      {isOpen && <BatchDriverContent sessionIds={sessionIds} onClose={onClose} />}
    </Modal>
  );
};

const BatchDriverContent: React.FC<{ sessionIds: number[]; onClose: () => void }> = ({ sessionIds, onClose }) => {
  const { t } = useI18n();
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const sessions = useSessionListStore((s) => s.sessions);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BatchPlayerResult | null>(null);
  const [suggestions, setSuggestions] = useState<DriverNameSuggestion[] | null>(null);

  // The latest selected sessions, as the list shows them, taken once per opening
  const [sampled] = useState(() => {
    const selected = new Set(sessionIds);
    return useSessionListStore
      .getState()
      .sessions.filter((s) => selected.has(s.id))
      .slice(0, SUGGESTION_SESSIONS);
  });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(sampled.map((s) => getSessionLapData(s.id))).then((loaded) => {
      if (cancelled) return;
      const found = loaded.flatMap((entry, index) =>
        entry.status === 'fulfilled' ? [{ sessionType: sampled[index].session_type, data: entry.value }] : []
      );
      setSuggestions(driverNameSuggestions(found));
    });
    return () => {
      cancelled = true;
    };
  }, [sampled]);

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    const driverName = name.trim();
    if (!driverName) return;
    setSaving(true);
    try {
      setResult(await useSessionListStore.getState().setPlayerByName(sessionIds, driverName));
    } catch (err: unknown) {
      useToastStore.getState().showToast({
        type: 'error',
        message: t('history.player.picker.saveError', { message: err instanceof Error ? err.message : String(err) }),
      });
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <>
        <ModalBody className={styles.body}>
          <BatchDriverResult result={result} sessions={sessions} driverName={name.trim()} />
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={onClose}>
            {t('common.done')}
          </Button>
        </ModalFooter>
      </>
    );
  }

  const selectedCount = sessionIds.length;
  return (
    <form onSubmit={apply} className={styles.form}>
      <ModalBody className={styles.body}>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.label}>
            {t('history.player.batch.nameLabel')}
          </label>
          <TextInput
            id={inputId}
            list={listId}
            value={name}
            autoComplete="off"
            autoFocus
            aria-describedby={hintId}
            onChange={(event) => setName(event.target.value)}
          />
          <datalist id={listId}>
            {suggestions?.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
          <p id={hintId} className={styles.hint}>
            {t('history.player.batch.hint')}
          </p>
        </div>

        <section className={styles.suggestions} aria-labelledby={`${listId}-title`} aria-busy={suggestions === null}>
          <h3 id={`${listId}-title`} className={styles.suggestionsTitle}>
            {sampled.length < selectedCount
              ? t('history.player.batch.suggestionsSampled', { count: sampled.length, total: selectedCount })
              : t('history.player.batch.suggestions')}
          </h3>
          {suggestions === null ? (
            <SkeletonGroup label={t('history.player.picker.loading')}>
              <SkeletonChips count={4} />
            </SkeletonGroup>
          ) : suggestions.length === 0 ? (
            <EmptyState compact title={t('history.player.batch.noSuggestions')} />
          ) : (
            <ul className={styles.chips}>
              {suggestions.slice(0, SUGGESTION_BUTTONS).map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    className={styles.chip}
                    aria-pressed={name.trim().toLowerCase() === s.name.toLowerCase()}
                    aria-label={t('history.player.batch.suggestionLabel', {
                      name: s.name,
                      count: s.sessions,
                      total: sampled.length,
                    })}
                    onClick={() => setName(s.name)}
                  >
                    <span className={styles.chipName}>{s.name}</span>
                    <span className={styles.chipCount} aria-hidden="true">
                      {s.sessions}/{sampled.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" variant="primary" disabled={!name.trim()} loading={saving}>
          {t('history.player.batch.apply', { count: selectedCount })}
        </Button>
      </ModalFooter>
    </form>
  );
};

const BatchDriverResult: React.FC<{ result: BatchPlayerResult; sessions: SessionListItem[]; driverName: string }> = ({
  result,
  sessions,
  driverName,
}) => {
  const { t } = useI18n();
  const units = useUnits();
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const groups = [
    { key: 'updated', ids: result.updated, title: t('history.player.batch.updated', { count: result.updated.length }) },
    {
      key: 'notFound',
      ids: result.not_found,
      title: t('history.player.batch.notFound', { count: result.not_found.length, name: driverName }),
    },
    {
      key: 'ambiguous',
      ids: result.ambiguous,
      title: t('history.player.batch.ambiguous', { count: result.ambiguous.length, name: driverName }),
    },
  ];
  return (
    <div className={styles.result} role="status">
      {groups.map((group) => (
        <section key={group.key} className={styles.resultGroup} data-kind={group.key}>
          <h3 className={styles.resultTitle}>{group.title}</h3>
          {group.key !== 'updated' && group.ids.length > 0 && (
            <ul className={styles.resultList}>
              {group.ids.map((id) => {
                const session = byId.get(id);
                return (
                  <li key={id}>
                    {session
                      ? `${session.track_name} · ${sessionTypeLabel(session.session_type, t)} · ${units.dateAndTime(session.created_at)}`
                      : `#${id}`}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};
