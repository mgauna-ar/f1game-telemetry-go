import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { LapComparator } from './components/LapComparator'
import { SessionHistory } from './components/SessionHistory'

function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'comparator' | 'history'>('live')

  return (
    <div>
      <div className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          Live Telemetry
        </button>
        <button 
          className={`nav-tab ${activeTab === 'comparator' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparator')}
        >
          Lap Comparator
        </button>
        <button 
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Session History
        </button>
      </div>

      {activeTab === 'live' ? (
        <Dashboard />
      ) : activeTab === 'comparator' ? (
        <LapComparator />
      ) : (
        <SessionHistory />
      )}
    </div>
  )
}

export default App

