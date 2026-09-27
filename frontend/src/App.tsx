import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Calendar, GitCompare, Radio, Sparkles } from 'lucide-react';
import { F1TelemetryLogo } from './components/F1TelemetryLogo';
import { RaceEngineerProvider } from './context/RaceEngineerProvider';
import { useRaceEngineerActions } from './context/RaceEngineerContext';
import { I18nProvider } from './context/I18nProvider';
import { useI18n } from './context/I18nContext';
import { AiRaceEngineer } from './components/AiRaceEngineer';
import { LanguageSelector } from './components/LanguageSelector';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/ToastContainer';
import { SettingsSync } from './components/common/SettingsSync';
import { ToastContext } from './context/ToastContext';
import { api } from './utils/apiClient';
import { storage } from './utils/storage';
import { useRadioSettingsStore } from './store/useRadioSettingsStore';
import { useTelemetryEndpointStore } from './store/useTelemetryEndpointStore';
import { useLiveStatus } from './hooks/useLiveStatus';
import { LIVE_STATUS } from './constants/f1';
import type { UpdateCheckResponse, SystemVersion } from './types/system';
import styles from './App.module.css';

const SessionHistory = lazy(() => import('./components/SessionHistory').then((m) => ({ default: m.SessionHistory })));
const LapComparator = lazy(() => import('./components/LapComparator').then((m) => ({ default: m.LapComparator })));
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const ReleaseNotesModal = lazy(() =>
  import('./components/ReleaseNotesModal').then((m) => ({ default: m.ReleaseNotesModal }))
);

type TabType = 'history' | 'comparator' | 'live';

const NAV_TABS: ReadonlyArray<{ id: TabType; icon: typeof Calendar; labelKey: string }> = [
  { id: 'history', icon: Calendar, labelKey: 'nav.tabs.history' },
  { id: 'comparator', icon: GitCompare, labelKey: 'nav.tabs.comparator' },
  { id: 'live', icon: Radio, labelKey: 'nav.tabs.live' },
];

/** Which kind of build is running, for the version badge's colour. */
const releaseChannel = (
  systemVersion: SystemVersion | null,
  currentVersion: string | undefined
): 'dev' | 'beta' | undefined => {
  if (systemVersion?.is_dev || currentVersion?.startsWith('dev')) return 'dev';
  if (systemVersion?.is_beta || currentVersion?.includes('beta') || currentVersion?.includes('rc')) return 'beta';
  return undefined;
};

const STORAGE_KEY = 'f1_active_tab';
const DISMISSED_UPDATE_KEY = 'f1_telemetry_dismissed_update';

function AppContent() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = storage.get<string>(STORAGE_KEY, 'history');
    if (saved === 'history' || saved === 'comparator' || saved === 'live') {
      return saved;
    }
    return 'history';
  });

  const { setContextMode } = useRaceEngineerActions();
  const liveStatus = useLiveStatus();
  const udpPort = useTelemetryEndpointStore((s) => s.endpoint.udp_port);
  const isLiveFeedActive = liveStatus === LIVE_STATUS.LIVE;

  // Update checking & version state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [systemVersion, setSystemVersion] = useState<SystemVersion | null>(null);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    return storage.get<string | null>(DISMISSED_UPDATE_KEY, null);
  });

  const checkUpdates = useCallback(async () => {
    try {
      const [updateRes, versionRes] = await Promise.allSettled([
        api.get<UpdateCheckResponse>('/api/system/check-updates'),
        api.get<SystemVersion>('/api/system/version'),
      ]);
      if (updateRes.status === 'fulfilled') {
        setUpdateInfo(updateRes.value);
      }
      if (versionRes.status === 'fulfilled') {
        setSystemVersion(versionRes.value);
      }
    } catch {
      // Ignore update check failures when offline
    }
  }, []);

  useEffect(() => {
    checkUpdates();
    const radioSettings = useRadioSettingsStore.getState();
    radioSettings.loadConfigFromBackend();
    radioSettings.loadVoiceFromBackend();
    useTelemetryEndpointStore.getState().loadEndpoint();
  }, [checkUpdates]);

  const handleDismissVersion = (version: string) => {
    setDismissedVersion(version);
    storage.set(DISMISSED_UPDATE_KEY, version);
  };

  const [comparatorPreload, setComparatorPreload] = useState<{
    sessionId?: number;
    lapId?: number;
    slot?: 'A' | 'B';
    sessionAId?: number;
    lapAId?: number;
    sessionBId?: number;
    lapBId?: number;
  } | null>(null);

  useEffect(() => {
    storage.set(STORAGE_KEY, activeTab);
    if (activeTab === 'live') {
      setContextMode('live');
    } else if (activeTab === 'comparator') {
      setContextMode('comparator');
    } else if (activeTab === 'history') {
      // If we switch to history, default to session_debrief or general
      setContextMode('general');
    }
  }, [activeTab, setContextMode]);

  const handleNavigateToComparator = (
    payload:
      | {
          sessionId?: number;
          lapId?: number;
          slot?: 'A' | 'B';
          sessionAId?: number;
          lapAId?: number;
          sessionBId?: number;
          lapBId?: number;
        }
      | number,
    lapId?: number,
    slot?: 'A' | 'B'
  ) => {
    if (typeof payload === 'object') {
      setComparatorPreload(payload);
    } else {
      setComparatorPreload({ sessionId: payload, lapId: lapId!, slot: slot || 'A' });
    }
    setActiveTab('comparator');
  };

  const versionDetails = systemVersion
    ? [
        t('common.updates.commit', { commit: systemVersion.commit }),
        systemVersion.build_date && systemVersion.build_date !== 'unknown'
          ? t('common.updates.buildDate', { date: systemVersion.build_date })
          : null,
      ]
        .filter(Boolean)
        .join(' • ')
    : t('nav.currentVersion');
  const isLiveBadgeShown = liveStatus === LIVE_STATUS.LIVE || liveStatus === LIVE_STATUS.STALE;
  const isStale = liveStatus === LIVE_STATUS.STALE;

  return (
    <div className={styles.app}>
      <header className={styles.topNav}>
        <div className={styles.brand}>
          <div className={styles.logo} data-live={isLiveFeedActive || undefined}>
            <F1TelemetryLogo size={28} animated={isLiveFeedActive} />
          </div>
          <div className={styles.brandText}>
            <p className={styles.brandTitle}>
              <span className={styles.brandF1}>F1</span>
              <span className={styles.brandName}>TELEMETRY</span>
            </p>
            <div className={styles.brandSub}>{t('nav.brandSub')}</div>
          </div>
        </div>

        <nav className={styles.tabs} aria-label={t('nav.mainNavigation')}>
          {NAV_TABS.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              className={styles.tab}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{t(labelKey)}</span>
              {/* Only while packets arrive (or just stopped): the feed is only opened on this tab */}
              {id === 'live' && isLiveBadgeShown && (
                <span
                  className={styles.liveBadge}
                  data-stale={isStale || undefined}
                  title={isStale ? t('live.statusStaleTitle') : undefined}
                  data-testid="nav-live-badge"
                >
                  {isStale ? t('live.statusStale') : t('nav.liveBadge')}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.status}>
          {updateInfo?.update_available && dismissedVersion !== updateInfo.latest_version && (
            <button
              type="button"
              className={styles.updateChip}
              data-prerelease={updateInfo.is_prerelease || undefined}
              onClick={() => setIsReleaseModalOpen(true)}
              aria-label={t('nav.updateAvailable')}
              data-testid="nav-update-chip"
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>{updateInfo.latest_version || t('nav.updateAvailable')}</span>
            </button>
          )}

          <button
            type="button"
            className={styles.version}
            data-channel={releaseChannel(systemVersion, updateInfo?.current_version)}
            onClick={() => setIsReleaseModalOpen(true)}
            title={versionDetails}
            aria-label={t('nav.aboutApp')}
            data-testid="nav-version-badge"
          >
            <span>{systemVersion?.version || updateInfo?.current_version || 'dev'}</span>
          </button>

          <LanguageSelector />
          <span className={styles.port}>
            {t('nav.portBadge')} {udpPort}
          </span>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className={styles.main}>
        <ErrorBoundary level="section" onReset={() => {}}>
          <Suspense fallback={null}>
            {activeTab === 'history' ? (
              <SessionHistory onNavigateToComparator={handleNavigateToComparator} />
            ) : activeTab === 'comparator' ? (
              <LapComparator initialPreload={comparatorPreload} />
            ) : (
              <Dashboard />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Release Notes & Update Modal */}
      <Suspense fallback={null}>
        {isReleaseModalOpen && (
          <ReleaseNotesModal
            isOpen={isReleaseModalOpen}
            onClose={() => setIsReleaseModalOpen(false)}
            updateData={updateInfo}
            systemVersion={systemVersion}
            onDismissVersion={handleDismissVersion}
          />
        )}
      </Suspense>

      {/* Global Toast Notifications */}
      <ToastContainer />
      <SettingsSync />

      {/* Global Persistent Floating AI Race Engineer (Non-modal bottom-right widget) */}
      <ErrorBoundary level="widget">
        <AiRaceEngineer />
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <RaceEngineerProvider>
        <ErrorBoundary level="root">
          <ToastContext.Provider value={true}>
            <AppContent />
          </ToastContext.Provider>
        </ErrorBoundary>
      </RaceEngineerProvider>
    </I18nProvider>
  );
}

export default App;
