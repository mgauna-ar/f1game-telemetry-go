import React, { useId } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import type { UpdateCheckResponse } from '../types/system';
import { useInstallUpdate } from './useInstallUpdate';
import styles from './UpdateNotice.module.css';

interface InstallUpdateProps {
  release: UpdateCheckResponse;
  /** The button as wide as the box it's in. */
  block?: boolean;
}

/**
 * "Update now": the button that installs the release and restarts the app on it, what it's doing
 * and why it stopped. Only the PC running a release build can update it (`can_update`).
 */
export const InstallUpdate: React.FC<InstallUpdateProps> = ({ release, block }) => {
  const { t } = useI18n();
  const { state, install } = useInstallUpdate();
  const busy = state.phase === 'installing' || state.phase === 'restarting';
  let progress = t('desktop.update.hint');
  if (state.phase === 'installing') progress = t('desktop.update.installing', { version: release.latest_version });
  if (state.phase === 'restarting') progress = t('desktop.update.restarting');

  return (
    <div className={styles.install}>
      {/* Always there, so screen readers hear the progress as it changes */}
      <p className={styles.hint} aria-live="polite">
        {progress}
      </p>
      <Button
        variant="secondary"
        block={block}
        icon={<Download size={16} />}
        loading={busy}
        onClick={() => void install()}
      >
        {t('desktop.update.button')}
      </Button>
      {state.phase === 'failed' && (
        <Callout tone="warning" role="alert">
          {t('desktop.update.failed', { error: state.error })}{' '}
          {release.html_url && (
            <a href={release.html_url} target="_blank" rel="noopener noreferrer">
              {t('desktop.update.releasePage')}
            </a>
          )}
        </Callout>
      )}
      {state.phase === 'timedOut' && (
        <Callout tone="warning" role="alert">
          {t('desktop.update.timedOut', { version: state.version })}
        </Callout>
      )}
    </div>
  );
};

interface UpdateNoticeProps {
  release: UpdateCheckResponse;
  /** Its heading's level: under the page's sections (2) or inside one (Settings → App). */
  level?: 2 | 3 | 4;
}

/**
 * A newer release, what's new in it and Update now: in the /desktop window and in Settings → App.
 */
export const UpdateNotice: React.FC<UpdateNoticeProps> = ({ release, level = 2 }) => {
  const { t } = useI18n();
  const headingId = useId();
  const Heading = `h${level}` as const;

  return (
    <section className={styles.notice} aria-labelledby={headingId}>
      <div className={styles.header}>
        <Heading id={headingId} className={styles.title}>
          {t('desktop.update.available', { version: release.latest_version })}
        </Heading>
        {release.html_url && (
          <a href={release.html_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t('desktop.update.whatsNew')}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </div>
      <InstallUpdate release={release} block />
    </section>
  );
};
