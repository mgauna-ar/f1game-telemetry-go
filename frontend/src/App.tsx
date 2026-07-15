import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { LapComparator } from './components/LapComparator'

function App() {
  const [activeTab, setActiveTab] = useState<'live' | 'comparator'>('live')

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
      </div>

      {activeTab === 'live' ? <Dashboard /> : <LapComparator />}
    </div>
  )
}

export default App
