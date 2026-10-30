import React, { useEffect, useState } from 'react';
import { Package, Power, Rocket, Smartphone } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { UpdateNotice } from '../../desktop/UpdateNotice';
import { useAppUpdateStore } from '../../store/useAppUpdateStore';
import { useDesktopStore } from '../../store/useDesktopStore';
import { dashboardUrlOn, otherDeviceIps, useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { desktopClient } from '../../utils/desktopClient';
import type { DesktopUpdate } from '../../types/desktop';
import { CopyValueButton } from '../common/CopyValueButton';
import { SettingSection, ToggleRow } from '../radio_settings/SettingControls';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { SkeletonGroup, SkeletonRows } from '../ui/Skeleton';
import shared from '../radio_settings/RadioSettings.module.css';
import styles from './AppSection.module.css';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The version running, and Update now once a newer release is out (release builds only). */
const VersionSection: React.FC<{ canUpdate: boolean }> = ({ canUpdate }) => {
  const { t } = useI18n();
  const version = useAppUpdateStore((s) => s.version);
  const release = useAppUpdateStore((s) => s.release);
  const running = version?.version ?? release?.current_version;
  let note: string | null = null;
  if (version?.is_dev) note = t('settings.app.devBuild');
  else if (canUpdate && release && !release.update_available) note = t('settings.app.upToDate');

  return (
    <SettingSection icon={<Package size={14} />} title={t('settings.app.version')}>
      {running && <p className={styles.version}>{t('settings.app.running', { version: running })}</p>}
      {canUpdate && release?.update_available && <UpdateNotice release={release} level={4} />}
      {note && <p className={shared.hint}>{note}</p>}
    </SettingSection>
  );
};

/**
 * Settings → App: F1 Telemetry on the PC it runs on, the only one /api/desktop answers. Its version
 * and Update now, how it starts, the address a phone or tablet opens, and Quit. On Windows the
 * app's window has these here; on macOS and Linux its small window has them too.
 */
export const AppSection: React.FC = () => {
  const { t } = useI18n();
  const state = useDesktopStore((s) => s.state);
  const status = useDesktopStore((s) => s.status);
  const endpoint = useTelemetryEndpointStore((s) => s.endpoint);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [quitError, setQuitError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  // Read again on opening: Start with Windows may have changed from the tray
  useEffect(() => {
    void useDesktopStore.getState().refresh();
    void useAppUpdateStore.getState().load();
  }, []);

  if (!state) {
    if (status === 'unavailable') return <p className={shared.hint}>{t('settings.app.unavailable')}</p>;
    return (
      <SkeletonGroup label={t('common.loading')}>
        <SkeletonRows rows={4} />
      </SkeletonGroup>
    );
  }

  const change = async (update: DesktopUpdate) => {
    setSaveError(null);
    try {
      await useDesktopStore.getState().update(update);
    } catch (err) {
      setSaveError(t('desktop.saveFailed', { error: errorText(err) }));
    }
  };

  const quit = async () => {
    setQuitError(null);
    try {
      await desktopClient.quit();
    } catch (err) {
      // fetch fails with a TypeError when nothing answers: the app had already stopped
      if (!(err instanceof TypeError)) {
        setQuitError(t('desktop.quitFailed', { error: errorText(err) }));
        return;
      }
    }
    setStopped(true);
  };

  // The app's own window (Windows) or the small browser window (macOS and Linux)
  const ownWindow = state.native_window;
  const otherIps = otherDeviceIps(endpoint);

  return (
    <>
      <VersionSection canUpdate={state.can_update} />

      <SettingSection icon={<Rocket size={14} />} title={t('settings.app.startup')}>
        <div className={shared.stack}>
          <ToggleRow
            label={t(ownWindow ? 'settings.app.openWindow' : 'settings.app.openAppWindow')}
            description={t(ownWindow ? 'settings.app.openWindowDesc' : 'settings.app.openAppWindowDesc')}
            checked={state.show_window_at_start}
            onChange={(on) => void change({ show_window_at_start: on })}
          />
          {state.start_with_os_available && (
            <ToggleRow
              label={t('settings.app.startWithWindows')}
              description={t('settings.app.startWithWindowsDesc')}
              checked={state.start_with_os}
              onChange={(on) => void change({ start_with_os: on })}
            />
          )}
        </div>
        {saveError && (
          <Callout tone="warning" role="alert">
            {saveError}
          </Callout>
        )}
      </SettingSection>

      <SettingSection icon={<Smartphone size={14} />} title={t('settings.app.otherDevice')}>
        {otherIps.length > 0 ? (
          <>
            <ul className={styles.addresses}>
              {otherIps.map((ip) => (
                <li key={ip}>
                  <CopyValueButton value={dashboardUrlOn(ip)} />
                </li>
              ))}
            </ul>
            <p className={shared.hint}>{t('settings.app.otherDeviceHint')}</p>
          </>
        ) : (
          <p className={shared.hint}>{t('settings.app.noOtherDevice')}</p>
        )}
      </SettingSection>

      <SettingSection icon={<Power size={14} />} title={t('settings.app.quit')}>
        <p className={shared.hint}>{t(ownWindow ? 'settings.app.closeNoteWindow' : 'settings.app.closeNoteBrowser')}</p>
        {stopped ? (
          <Callout role="status">{t('settings.app.stopped')}</Callout>
        ) : (
          <Button variant="ghost" icon={<Power size={16} />} onClick={quit} className={styles.quit}>
            {t('desktop.quit')}
          </Button>
        )}
        {quitError && (
          <Callout tone="warning" role="alert">
            {quitError}
          </Callout>
        )}
      </SettingSection>
    </>
  );
};
