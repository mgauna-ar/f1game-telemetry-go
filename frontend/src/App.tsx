import { useState, useEffect } from 'react';
import { Calendar, GitCompare, Radio } from 'lucide-react';
import { F1TelemetryLogo } from './components/F1TelemetryLogo';
import { Dashboard } from './components/Dashboard';
import { LapComparator } from './components/LapComparator';
import { SessionHistory } from './components/SessionHistory';
import { RaceEngineerProvider } from './context/RaceEngineerProvider';
import { useRaceEngineer } from './context/RaceEngineerContext';
import { I18nProvider } from './context/I18nProvider';
import { useI18n } from './context/I18nContext';
import { AiRaceEngineer } from './components/AiRaceEngineer';
import { LanguageSelector } from './components/LanguageSelector';

type TabType = 'history' | 'comparator' | 'live';

const STORAGE_KEY = 'f1_active_tab';

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

  const { setContextMode } = useRaceEngineer();

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
          <LanguageSelector />
          <span className="mono nav-port-badge">{t('nav.portBadge')} 20777</span>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="app-main-content">
        {activeTab === 'history' ? (
          <SessionHistory onNavigateToComparator={handleNavigateToComparator} />
        ) : activeTab === 'comparator' ? (
          <LapComparator initialPreload={comparatorPreload} />
        ) : (
          <Dashboard />
        )}
      </main>

      {/* Global Persistent Floating AI Race Engineer (Non-modal bottom-right widget) */}
      <AiRaceEngineer />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <RaceEngineerProvider>
        <AppContent />
      </RaceEngineerProvider>
    </I18nProvider>
  );
}

export default App;

