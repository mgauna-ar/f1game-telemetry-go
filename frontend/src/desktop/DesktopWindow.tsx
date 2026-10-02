import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Power } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useSystemStatusStore } from '../store/useSystemStatusStore';
import { otherDeviceIps, useTelemetryEndpointStore } from '../store/useTelemetryEndpointStore';
import { LIVE_STATUS } from '../constants/f1';
import type { LiveStatus } from '../constants/f1';
import { F1TelemetryLogo } from '../components/F1TelemetryLogo';
import { CopyValueButton } from '../components/common/CopyValueButton';
import { Button } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { Switch } from '../components/ui/Switch';
import { api, ApiError } from '../utils/apiClient';
import { desktopClient } from '../utils/desktopClient';
import { liveSessionLabel } from '../utils/liveSessionLabel';
import type { DesktopState, DesktopUpdate } from '../types/desktop';
import type { SystemVersion } from '../types/system';
import { useFitWindowToContent } from './useFitWindowToContent';
import styles from './DesktopWindow.module.css';

const LOGO_SIZE = 44;

/** The dashboard address on another host, keeping this page's protocol and port. */
const dashboardUrlOn = (host: string): string => {
  const { protocol, port } = window.location;
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
};

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The live feed in one line: the session being driven, paused, or waiting for the game. */
const StatusLine: React.FC<{ status: LiveStatus; udpPort: number }> = ({ status, udpPort }) => {
  const { t } = useI18n();
  const session = useSystemStatusStore((s) => s.session);
  let text: string;
  if (status === LIVE_STATUS.LIVE && session) {
    const { kind, track } = liveSessionLabel(session, t);
    text = t('desktop.status.live', { session: kind, track });
  } else if (status === LIVE_STATUS.STALE) {
    text = t('desktop.status.stale');
  } else if (status === LIVE_STATUS.OFFLINE) {
    text = t('desktop.status.offline');
  } else {
    text = t('desktop.status.listening', { port: udpPort });
  }
  return (
    <p className={styles.status} data-status={status} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {text}
    </p>
  );
};

/**
 * The app window: a small page the server opens in a browser window of its own at startup (and
 * from the Windows tray). It shows whether the game is sending telemetry, where to open the
 * dashboard and what to enter in the game, and on the PC running the app its startup options and Quit.
 */
export const DesktopWindow: React.FC = () => {
  const { t } = useI18n();
  const status = useLiveStatus();
  const endpoint = useTelemetryEndpointStore((s) => s.endpoint);
  const [version, setVersion] = useState<string | null>(null);
  // null while loading; 'unavailable' when the server won't take these from this device
  const [desktop, setDesktop] = useState<DesktopState | 'unavailable' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const startupHeadingId = useId();
  const otherIps = otherDeviceIps(endpoint);
  const windowRef = useRef<HTMLElement>(null);
  useFitWindowToContent(windowRef);

  // The app window's title bar shows the app's name, not the dashboard's long title
  useEffect(() => {
    document.title = t('desktop.title');
  }, [t]);

  useEffect(() => {
    useTelemetryEndpointStore.getState().loadEndpoint();
    const controller = new AbortController();
    api
      .get<SystemVersion>('/api/system/version', controller.signal)
      .then((v) => setVersion(v.version))
      .catch(() => {});
    desktopClient
      .getState(controller.signal)
      .then(setDesktop)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setDesktop('unavailable');
        if (!(err instanceof ApiError)) setError(errorText(err));
      });
    return () => controller.abort();
  }, []);

  const update = useCallback(
    async (change: DesktopUpdate) => {
      setError(null);
      try {
        setDesktop(await desktopClient.update(change));
      } catch (err) {
        setError(t('desktop.saveFailed', { error: errorText(err) }));
      }
    },
    [t]
  );

  const openDashboard = async () => {
    setError(null);
    try {
      await desktopClient.openDashboard();
    } catch (err) {
      setError(t('desktop.openFailed', { error: errorText(err) }));
    }
  };

  const quit = async () => {
    setError(null);
    try {
      await desktopClient.quit();
    } catch (err) {
      // fetch fails with a TypeError when nothing answers: the app on this PC has already stopped
      // (Ctrl+C in its terminal, or it closed), and only this window outlived it
      if (!(err instanceof TypeError)) {
        setError(t('desktop.quitFailed', { error: errorText(err) }));
        return;
      }
    }
    setStopped(true);
    window.close();
  };

  if (stopped) {
    return (
      <main className={styles.window}>
        <div className={styles.stopped}>
          <F1TelemetryLogo size={LOGO_SIZE} variant="monochrome" />
          <h1 className={styles.title}>{t('desktop.stoppedTitle')}</h1>
          <p className={styles.note}>{t('desktop.stoppedBody')}</p>
        </div>
      </main>
    );
  }

  const controls = desktop !== null && desktop !== 'unavailable' ? desktop : null;

  return (
    <main ref={windowRef} className={styles.window}>
      <header className={styles.header}>
        <F1TelemetryLogo size={LOGO_SIZE} />
        <div>
          <h1 className={styles.title}>{t('desktop.title')}</h1>
          {version && <p className={styles.version}>{t('desktop.version', { version })}</p>}
        </div>
      </header>

      <StatusLine status={status} udpPort={endpoint.udp_port} />

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('desktop.dashboardHeading')}</h2>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>{t('desktop.thisPc')}</dt>
            <dd>
              <CopyValueButton value={window.location.origin} />
            </dd>
          </div>
          {otherIps.map((ip) => (
            <div key={ip} className={styles.row}>
              <dt>{t('desktop.otherDevice')}</dt>
              <dd>
                <CopyValueButton value={dashboardUrlOn(ip)} />
              </dd>
            </div>
          ))}
        </dl>
        {controls && (
          <Button variant="primary" block icon={<ExternalLink size={16} />} onClick={openDashboard}>
            {t('desktop.openDashboard')}
          </Button>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{t('desktop.gameHeading')}</h2>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>{t('desktop.udpPort')}</dt>
            <dd className={styles.value}>{endpoint.udp_port}</dd>
          </div>
          <div className={styles.row}>
            <dt>{t('desktop.ipAddress')}</dt>
            <dd className={styles.ips}>
              <span className={styles.ip}>
                <CopyValueButton value={endpoint.local_ip} />
                <span className={styles.hint}>{t('desktop.ipThisPc')}</span>
              </span>
              {otherIps.map((ip) => (
                <span key={ip} className={styles.ip}>
                  <CopyValueButton value={ip} />
                  <span className={styles.hint}>{t('desktop.ipConsole')}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      {error && (
        <Callout tone="warning" role="alert">
          {error}
        </Callout>
      )}

      {controls && (
        <section className={styles.section} aria-labelledby={startupHeadingId}>
          <h2 id={startupHeadingId} className={styles.heading}>
            {t('desktop.startupHeading')}
          </h2>
          <label className={styles.option}>
            <Switch
              checked={controls.show_window_at_start}
              onChange={(on) => void update({ show_window_at_start: on })}
            />
            <span>
              <span className={styles.optionLabel}>{t('desktop.showAtStart')}</span>
              <span className={styles.hint}>
                {t(controls.tray ? 'desktop.showAtStartHintTray' : 'desktop.showAtStartHintTerminal')}
              </span>
            </span>
          </label>
          {controls.start_with_os_available && (
            <label className={styles.option}>
              <Switch checked={controls.start_with_os} onChange={(on) => void update({ start_with_os: on })} />
              <span>
                <span className={styles.optionLabel}>{t('desktop.startWithWindows')}</span>
                <span className={styles.hint}>{t('desktop.startWithWindowsHint')}</span>
              </span>
            </label>
          )}
        </section>
      )}

      <footer className={styles.footer}>
        {controls ? (
          <>
            <p className={styles.note}>{t(controls.tray ? 'desktop.closeNoteTray' : 'desktop.closeNoteTerminal')}</p>
            <Button variant="ghost" icon={<Power size={16} />} onClick={quit}>
              {t('desktop.quit')}
            </Button>
          </>
        ) : (
          desktop === 'unavailable' && <p className={styles.note}>{t('desktop.controlsUnavailable')}</p>
        )}
      </footer>
    </main>
  );
};
