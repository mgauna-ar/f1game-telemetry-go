import React, { useEffect, useMemo } from 'react';
import { AppWindow } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useDeviceSettingsSync } from '../../hooks/useDeviceSettingsSync';
import { useLiveRadio } from '../../hooks/useLiveRadio';
import { useNativeWindowLinks } from '../../hooks/useNativeWindowLinks';
import { usePerformanceModeAttribute } from '../../hooks/usePerformanceMode';
import { useShowWindow } from '../../hooks/useShowWindow';
import { useRadioSettingsStore } from '../../store/useRadioSettingsStore';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryEndpointStore } from '../../store/useTelemetryEndpointStore';
import { isNativeWindow } from '../../utils/nativeWindow';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { SettingsSync } from '../common/SettingsSync';
import { ToastContainer } from '../common/ToastContainer';
import { LiveDocumentTitle } from '../LiveDocumentTitle';
import { SessionHeader } from '../SessionHeader';
import { VoiceCockpitView } from '../VoiceCockpitView';
import { IconButton } from '../ui/Button';
import styles from './EngineerPage.module.css';

/**
 * The race engineer on its own (/engineer): the voice cockpit with no menu. On Windows the engineer
 * window shows it from the app's start, hidden until it's opened, and the radio speaks and listens
 * only there, whatever page the main window shows. In a browser it's the same page.
 */
export const EngineerPage: React.FC = () => {
  const { t } = useI18n();
  const radio = useLiveRadio();
  const session = useSessionStatusStore((s) => s.session);
  const connected = useSessionStatusStore((s) => s.connected);
  const packetFormat = useSessionStatusStore((s) => s.packetFormat);
  const showWindow = useShowWindow();
  useNativeWindowLinks();
  useDeviceSettingsSync();
  usePerformanceModeAttribute();

  // The shared settings the radio speaks with, and where the game sends its telemetry
  useEffect(() => {
    const radioSettings = useRadioSettingsStore.getState();
    radioSettings.loadConfigFromBackend();
    radioSettings.loadVoiceFromBackend();
    useTelemetryEndpointStore.getState().loadEndpoint();
  }, []);

  // The way back to the dashboard, in the app's main window
  const actions = useMemo(
    () =>
      isNativeWindow() && (
        <IconButton
          variant="secondary"
          size="sm"
          label={t('live.engineerWindow.openApp')}
          onClick={() => showWindow('main')}
          data-testid="engineer-open-app"
        >
          <AppWindow size={14} />
        </IconButton>
      ),
    [t, showWindow]
  );

  return (
    <div className={styles.page}>
      <LiveDocumentTitle />
      <SessionHeader
        session={session}
        connected={connected}
        packetFormat={packetFormat}
        actions={actions}
        standbyTitle={t('live.engineerWindow.standbyTitle')}
      />
      <ErrorBoundary level="section" onReset={() => {}}>
        <VoiceCockpitView radio={radio} />
      </ErrorBoundary>
      <ToastContainer />
      <SettingsSync />
    </div>
  );
};
