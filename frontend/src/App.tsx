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
import type { UpdateCheckResponse, SystemVersion } from './types/system';

const SessionHistory = lazy(() =>
  import('./components/SessionHistory').then((m) => ({ default: m.SessionHistory }))
);
const LapComparator = lazy(() =>
  import('./components/LapComparator').then((m) => ({ default: m.LapComparator }))
);
const Dashboard = lazy(() =>
  import('./components/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const ReleaseNotesModal = lazy(() =>
  import('./components/ReleaseNotesModal').then((m) => ({ default: m.ReleaseNotesModal }))
);

type TabType = 'history' | 'comparator' | 'live';

const STORAGE_KEY = 'f1_active_tab';
const DISMISSED_UPDATE_KEY = 'f1_telemetry_dismissed_update';

function AppContent() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'history' || saved === 'comparator' || saved === 'live') {
        return saved;
      }
    } catch {
      // Ignore localStorage access issues
    }
    return 'history';
  });

  const { setContextMode } = useRaceEngineerActions();

  // Update checking & version state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [systemVersion, setSystemVersion] = useState<SystemVersion | null>(null);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISSED_UPDATE_KEY);
    } catch {
      return null;
    }
  });

  const checkUpdates = useCallback(async () => {
    try {
      const [updateRes, versionRes] = await Promise.allSettled([
        fetch('/api/system/check-updates'),
        fetch('/api/system/version'),
      ]);
      if (updateRes.status === 'fulfilled' && updateRes.value.ok) {
        const data: UpdateCheckResponse = await updateRes.value.json();
        setUpdateInfo(data);
      }
      if (versionRes.status === 'fulfilled' && versionRes.value.ok) {
        const verData: SystemVersion = await versionRes.value.json();
        setSystemVersion(verData);
      }
    } catch {
      // Ignore update check failures when offline
    }
  }, []);

  useEffect(() => {
    checkUpdates();
  }, [checkUpdates]);

  const handleDismissVersion = (version: string) => {
    setDismissedVersion(version);
    try {
      localStorage.setItem(DISMISSED_UPDATE_KEY, version);
    } catch {
      // Ignore
    }
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
    try {
      localStorage.setItem(STORAGE_KEY, activeTab);
    } catch {
      // Ignore localStorage write issues
    }
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

  return (
    <div className="app-container">
      {/* Modern Top Navigation Bar */}
      <header className="app-top-nav">
        <div className="app-nav-brand">
          <div className={`app-brand-logo ${activeTab === 'live' ? 'live' : ''}`}>
            <F1TelemetryLogo size={28} animated={activeTab === 'live'} />
          </div>
          <div className="app-brand-text">
            <div className="app-brand-title">
              <span className="app-brand-f1">F1</span>
              <span className="app-brand-name">TELEMETRY</span>
            </div>
            <div className="app-brand-sub mono">{t('nav.brandSub')}</div>
          </div>
        </div>

        {/* Reordered Navigation Tabs: 1) Session History, 2) Lap Comparator, 3) Live Telemetry */}
        <nav className="app-nav-tabs" role="tablist" aria-label="Main Navigation">
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`app-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Calendar size={16} className="nav-tab-icon" />
            <span>{t('nav.tabs.history')}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'comparator'}
            className={`app-nav-tab ${activeTab === 'comparator' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparator')}
          >
            <GitCompare size={16} className="nav-tab-icon" />
            <span>{t('nav.tabs.comparator')}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'live'}
            className={`app-nav-tab ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <Radio size={16} className="nav-tab-icon" />
            <span>{t('nav.tabs.live')}</span>
            <span className="live-pulse-badge">
              <span className="live-pulse-dot" />
              {t('nav.liveBadge')}
            </span>
          </button>
        </nav>

        {/* Status & Language Controls */}
        <div className="app-nav-status">
          {updateInfo?.update_available && dismissedVersion !== updateInfo.latest_version && (
            <button
              type="button"
              className={`nav-update-chip ${updateInfo.is_prerelease ? 'prerelease' : ''}`}
              onClick={() => setIsReleaseModalOpen(true)}
              aria-label={t('nav.updateAvailable')}
              data-testid="nav-update-chip"
            >
              <Sparkles size={13} className="animate-pulse" />
              <span>{updateInfo.latest_version || t('nav.updateAvailable')}</span>
            </button>
          )}

          {/* Active Application Version Badge */}
          <button
            type="button"
            className={`mono nav-version-badge ${
              systemVersion?.is_dev || (updateInfo?.current_version && updateInfo.current_version.startsWith('dev'))
                ? 'dev'
                : systemVersion?.is_beta || (updateInfo?.current_version && (updateInfo.current_version.includes('beta') || updateInfo.current_version.includes('rc')))
                ? 'beta'
                : ''
            }`}
            onClick={() => setIsReleaseModalOpen(true)}
            title={
              systemVersion
                ? `Commit: ${systemVersion.commit}${
                    systemVersion.build_date && systemVersion.build_date !== 'unknown'
                      ? ` • Built: ${systemVersion.build_date}`
                      : ''
                  }`
                : t('nav.currentVersion')
            }
            aria-label={t('nav.aboutApp')}
            data-testid="nav-version-badge"
          >
            <span>{systemVersion?.version || updateInfo?.current_version || 'dev'}</span>
          </button>

          <LanguageSelector />
          <span className="mono nav-port-badge">{t('nav.portBadge')} 20777</span>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="app-main-content">
        <ErrorBoundary level="section" onReset={() => {}}>
          <Suspense fallback={<div className="loading-state" />}>
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
          <AppContent />
        </ErrorBoundary>
      </RaceEngineerProvider>
    </I18nProvider>
  );
}

export default App;

