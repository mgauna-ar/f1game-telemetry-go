import React, { useEffect, useId, useMemo, useState } from 'react';
import { UserRound } from 'lucide-react';
import { getTeamColor } from '../../../constants/f1';
import { useI18n } from '../../../context/I18nContext';
import { useSessionListStore } from '../../../store/useSessionListStore';
import { useToastStore } from '../../../store/useToastStore';
import { styleVars } from '../../../styles/theme';
import type { Lap, Participant, Session } from '../../../types/session';
import { participantDisplayName } from '../../../utils/player';
import { getSessionLapData } from '../../../utils/sessionDataCache';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '../../ui/Modal';
import { Skeleton, SkeletonGroup } from '../../ui/Skeleton';
import { pickerParticipants } from './pickerParticipants';
import { usePlayerPickerStore } from './playerPickerStore';
import styles from './PlayerPickerModal.module.css';

/** The radio value of "None: I wasn't driving". */
const NONE = 'none';

/** "Who were you?": pick your car in a session, or none. Opened through `openPlayerPicker`. */
export const PlayerPickerModal: React.FC = () => {
  const session = usePlayerPickerStore((s) => s.session);
  const close = usePlayerPickerStore((s) => s.closePlayerPicker);
  const { t } = useI18n();
  // Leaving History closes it, so it doesn't reopen on the way back
  useEffect(() => close, [close]);

  return (
    <Modal isOpen={session !== null} onClose={close} size="sm" data-testid="player-picker">
      <ModalHeader
        tone="accent"
        icon={<UserRound size={20} />}
        title={t('history.player.picker.title')}
        subtitle={session ? `${session.track_name} · ${session.session_type}` : undefined}
      />
      {session && <PickerContent key={session.id} session={session} onClose={close} />}
    </Modal>
  );
};

const PickerContent: React.FC<{ session: Session; onClose: () => void }> = ({ session, onClose }) => {
  const { t } = useI18n();
  const legendId = useId();
  // The list has the latest pick; the session handed to the picker may be older
  const current = useSessionListStore((s) => s.sessions.find((item) => item.id === session.id)) ?? session;
  const currentCar = current.player_car_index;
  const initial = currentCar === null ? '' : String(currentCar);

  const [data, setData] = useState<{ participants: Participant[]; laps: Lap[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionLapData(session.id)
      .then((loaded) => !cancelled && setData(loaded))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  const drivers = useMemo(
    () => (data ? pickerParticipants(data.participants, data.laps, session.session_type) : []),
    [data, session.session_type]
  );

  const save = async () => {
    const carIndex = choice === NONE ? null : Number(choice);
    setSaving(true);
    try {
      await useSessionListStore.getState().setPlayerCar(session.id, carIndex);
      const driver = drivers.find((p) => p.car_index === carIndex);
      useToastStore.getState().showToast({
        type: 'success',
        message: driver
          ? t('history.player.picker.saved', { name: participantDisplayName(driver) })
          : t('history.player.picker.savedNone'),
      });
      onClose();
    } catch (err: unknown) {
      useToastStore.getState().showToast({
        type: 'error',
        message: t('history.player.picker.saveError', { message: err instanceof Error ? err.message : String(err) }),
      });
    } finally {
      setSaving(false);
    }
  };

  let body: React.ReactNode;
  if (error) {
    body = <EmptyState compact tone="danger" title={t('history.player.picker.loadError')} description={error} />;
  } else if (!data) {
    body = (
      <SkeletonGroup label={t('history.player.picker.loading')} className={styles.group}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} variant="block" height="2.25rem" />
        ))}
      </SkeletonGroup>
    );
  } else {
    body = (
      <fieldset className={styles.group} aria-labelledby={legendId}>
        <legend id={legendId} className="sr-only">
          {t('history.player.picker.legend')}
        </legend>
        {drivers.map((p) => {
          const value = String(p.car_index);
          return (
            <label
              key={p.car_index}
              className={styles.option}
              style={styleVars({ '--team-color': getTeamColor(p.team_id) })}
            >
              <input
                type="radio"
                name={`player-${session.id}`}
                value={value}
                checked={choice === value}
                onChange={() => setChoice(value)}
              />
              <span className={styles.position}>{p.position > 0 ? `P${p.position}` : '—'}</span>
              <span className={styles.number}>#{p.race_number}</span>
              <span className={styles.name}>{participantDisplayName(p)}</span>
              {p.car_index === currentCar && (
                <Badge size="xs" tone="accent" className={styles.current}>
                  {t(
                    current.player_car_source === 'user'
                      ? 'history.player.picker.chosen'
                      : 'history.player.picker.recorded'
                  )}
                </Badge>
              )}
            </label>
          );
        })}
        <label className={styles.option} data-none>
          <input
            type="radio"
            name={`player-${session.id}`}
            value={NONE}
            checked={choice === NONE}
            onChange={() => setChoice(NONE)}
          />
          <span className={styles.name}>{t('history.player.picker.none')}</span>
        </label>
      </fieldset>
    );
  }

  const unchanged = choice === '' || choice === initial || (choice === NONE && currentCar === null);
  return (
    <>
      <ModalBody className={styles.body}>{body}</ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!data || unchanged} loading={saving} onClick={save}>
          {t('history.player.picker.save')}
        </Button>
      </ModalFooter>
    </>
  );
};
