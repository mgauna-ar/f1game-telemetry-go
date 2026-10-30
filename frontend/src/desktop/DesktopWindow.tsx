import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppWindow, ExternalLink, Power } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useSystemStatusStore } from '../store/useSystemStatusStore';
import { dashboardUrlOn, otherDeviceIps, useTelemetryEndpointStore } from '../store/useTelemetryEndpointStore';
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
import type { SystemVersion, UpdateCheckResponse } from '../types/system';
import { useFitWindowToContent } from './useFitWindowToContent';
import { UpdateNotice } from './UpdateNotice';
import styles from './DesktopWindow.module.css';

const LOGO_SIZE = 44;

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
 * The app window on macOS and Linux: a small page the server opens in a browser window of its own
 * at startup. It shows whether the game is sending telemetry, where to open the dashboard and what
 * to enter in the game, and on the PC running the app its startup option, updates and Quit. On
 * Windows the app has a window of its own: a 1.x small window still open after the update says so
 * and brings that window up.
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
  const [release, setRelease] = useState<UpdateCheckResponse | null>(null);
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

  // The PC's own controls: null while loading and on another device
  const controls = desktop !== null && desktop !== 'unavailable' ? desktop : null;
  const ownWindow = controls?.native_window === true;

  // Only the PC running a release build can update it, so only then ask GitHub for a newer one
  const canUpdate = controls?.can_update === true && !ownWindow;
  useEffect(() => {
    if (!canUpdate) return;
    const controller = new AbortController();
    api
      .get<UpdateCheckResponse>('/api/system/check-updates', controller.signal)
      .then(setRelease)
      .catch(() => {});
    return () => controller.abort();
  }, [canUpdate]);

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

  // On Windows the dashboard is the app's own window: bring it up, and this one has nothing left to show
  const openOwnWindow = async () => {
    setError(null);
    try {
      await desktopClient.openDashboard();
    } catch (err) {
      setError(t('desktop.ownWindow.openFailed', { error: errorText(err) }));
      return;
    }
    window.close();
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
        <div className={styles.message}>
          <F1TelemetryLogo size={LOGO_SIZE} variant="monochrome" />
          <h1 className={styles.title}>{t('desktop.stoppedTitle')}</h1>
          <p className={styles.note}>{t('desktop.stoppedBody')}</p>
        </div>
      </main>
    );
  }

  if (ownWindow) {
    return (
      <main ref={windowRef} className={styles.window}>
        <div className={styles.message}>
          <F1TelemetryLogo size={LOGO_SIZE} />
          <h1 className={styles.title}>{t('desktop.ownWindow.title')}</h1>
          <p className={styles.note}>{t('desktop.ownWindow.body')}</p>
          <Button variant="primary" icon={<AppWindow size={16} />} onClick={openOwnWindow}>
            {t('desktop.ownWindow.open')}
          </Button>
          {error && (
            <Callout tone="warning" role="alert">
              {error}
            </Callout>
          )}
        </div>
      </main>
    );
  }

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

      {canUpdate && release?.update_available && <UpdateNotice release={release} />}

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
              <span className={styles.hint}>{t('desktop.showAtStartHint')}</span>
            </span>
          </label>
        </section>
      )}

      <footer className={styles.footer}>
        {controls ? (
          <>
            <p className={styles.note}>{t('desktop.closeNote')}</p>
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
