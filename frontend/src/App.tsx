import { useState, useEffect } from 'react';
import { Calendar, GitCompare, Radio, Gauge } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { LapComparator } from './components/LapComparator';
import { SessionHistory } from './components/SessionHistory';

type TabType = 'history' | 'comparator' | 'live';

const STORAGE_KEY = 'f1_active_tab';

function App() {
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
  }, [activeTab]);

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
          <div className="app-brand-icon">
            <Gauge size={19} color="var(--accent-primary)" />
          </div>
          <div className="app-brand-text">
            <div className="app-brand-title">
              F1 Telemetry <span className="app-brand-tag">PRO</span>
            </div>
            <div className="app-brand-sub mono">EA F1 2025 / 2026 DLC</div>
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
            <span>Session History</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'comparator'}
            className={`app-nav-tab ${activeTab === 'comparator' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparator')}
          >
            <GitCompare size={16} className="nav-tab-icon" />
            <span>Lap Comparator</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'live'}
            className={`app-nav-tab ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            <Radio size={16} className="nav-tab-icon" />
            <span>Live Session</span>
            <span className="live-pulse-badge">
              <span className="live-pulse-dot" />
              LIVE
            </span>
          </button>
        </nav>

        {/* Port Status Badge */}
        <div className="app-nav-status">
          <span className="mono nav-port-badge">PORT 20777</span>
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
    </div>
  );
}

export default App;
