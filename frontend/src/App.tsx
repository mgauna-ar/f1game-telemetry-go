import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Calendar, GitCompare, Radio, Sparkles, TrendingUp } from 'lucide-react';
import { F1TelemetryLogo } from './components/F1TelemetryLogo';
import { RaceEngineerProvider } from './context/RaceEngineerProvider';
import { I18nProvider } from './context/I18nProvider';
import { useI18n } from './context/I18nContext';
import { AiRaceEngineer } from './components/AiRaceEngineer';
import { LanguageSelector } from './components/LanguageSelector';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/ToastContainer';
import { SettingsSync } from './components/common/SettingsSync';
import { LiveSessionToast } from './components/common/LiveSessionToast';
import { ToastContext } from './context/ToastContext';
import { api } from './utils/apiClient';
import { storage } from './utils/storage';
import { useRadioSettingsStore } from './store/useRadioSettingsStore';
import { useTelemetryEndpointStore } from './store/useTelemetryEndpointStore';
import { useLiveStatus } from './hooks/useLiveStatus';
import { useMediaQuery } from './hooks/useMediaQuery';
import { PHONE_MEDIA } from './styles/breakpoints';
import { LIVE_STATUS, LIVE_VIEW_MODES } from './constants/f1';
import type { UpdateCheckResponse, SystemVersion } from './types/system';
import { Link } from './router/Link';
import { navigate, useRoute, useUrl } from './router/router';
import { buildPath, storeLastPage, storedLiveMode, type Page } from './router/routes';
import styles from './App.module.css';

const SessionHistory = lazy(() => import('./components/SessionHistory').then((m) => ({ default: m.SessionHistory })));
const LapComparator = lazy(() => import('./components/LapComparator').then((m) => ({ default: m.LapComparator })));
const TrackProgress = lazy(() =>
  import('./components/progress/TrackProgress').then((m) => ({ default: m.TrackProgress }))
);
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const ReleaseNotesModal = lazy(() =>
  import('./components/ReleaseNotesModal').then((m) => ({ default: m.ReleaseNotesModal }))
);

const NAV_TABS: ReadonlyArray<{ id: Page; icon: typeof Calendar; labelKey: string; shortKey: string }> = [
  { id: 'history', icon: Calendar, labelKey: 'nav.tabs.history', shortKey: 'nav.tabsShort.history' },
  { id: 'compare', icon: GitCompare, labelKey: 'nav.tabs.comparator', shortKey: 'nav.tabsShort.comparator' },
  { id: 'progress', icon: TrendingUp, labelKey: 'nav.tabs.progress', shortKey: 'nav.tabsShort.progress' },
  { id: 'live', icon: Radio, labelKey: 'nav.tabs.live', shortKey: 'nav.tabsShort.live' },
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

const DISMISSED_UPDATE_KEY = 'f1_telemetry_dismissed_update';

function AppContent() {
  const { t } = useI18n();
  const url = useUrl();
  const route = useRoute();
  const activePage = route.page;

  // Every URL is shown in one form: defaults filled in, unknown parts dropped.
  const canonicalUrl = buildPath(route);
  useEffect(() => {
    if (canonicalUrl !== url) navigate(canonicalUrl, { replace: true });
  }, [canonicalUrl, url]);

  useEffect(() => {
    storeLastPage(activePage);
  }, [activePage]);

  // The comparator and progress tabs go back to the laps last compared and the track last shown.
  const lastCompareUrl = useRef('/compare');
  const lastProgressUrl = useRef('/progress');
  if (activePage === 'compare') lastCompareUrl.current = canonicalUrl;
  if (activePage === 'progress') lastProgressUrl.current = canonicalUrl;
  const tabHref = (page: Page) => {
    switch (page) {
      case 'compare':
        return lastCompareUrl.current;
      case 'progress':
        return lastProgressUrl.current;
      case 'live':
        return buildPath({ page: 'live', mode: activePage === 'live' ? route.mode : storedLiveMode() });
      default:
        return '/history';
    }
  };

  // The Driver view on a phone takes the whole screen; its own mode switch leads back
  const isPhone = useMediaQuery(PHONE_MEDIA);
  const driverFocus = isPhone && route.page === 'live' && route.mode === LIVE_VIEW_MODES.DRIVER;

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
      <header className={styles.topNav} hidden={driverFocus}>
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
          {NAV_TABS.map(({ id, icon: Icon, labelKey, shortKey }) => (
            <Link
              key={id}
              href={tabHref(id)}
              aria-current={activePage === id ? 'page' : undefined}
              className={styles.tab}
            >
              <Icon size={16} aria-hidden="true" />
              {/* One of the two shows, by width; the hidden one is out of the accessibility tree */}
              <span className={styles.tabLabel}>{t(labelKey)}</span>
              <span className={styles.tabShort}>{t(shortKey)}</span>
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
            </Link>
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
              <span className={styles.updateText}>{updateInfo.latest_version || t('nav.updateAvailable')}</span>
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
            {activePage === 'history' ? (
              <SessionHistory />
            ) : activePage === 'compare' ? (
              <LapComparator />
            ) : activePage === 'progress' ? (
              <TrackProgress />
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
      <LiveSessionToast />
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
