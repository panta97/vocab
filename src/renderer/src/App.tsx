import { useEffect, useState } from 'react'
import { LookupView } from './components/LookupView'
import { HistoryView } from './components/HistoryView'
import { SettingsView } from './components/SettingsView'
import { AuthGate, AuthProvider } from './lib/auth'

type Tab = 'lookup' | 'history' | 'settings'

function Shell(): JSX.Element {
  const [tab, setTab] = useState<Tab>('lookup')

  return (
    <div className="app">
      <header className="app-header" data-tauri-drag-region>
        <nav className="tabs">
          <button
            className={tab === 'lookup' ? 'tab active' : 'tab'}
            onClick={() => setTab('lookup')}
          >
            Lookup
          </button>
          <button
            className={tab === 'history' ? 'tab active' : 'tab'}
            onClick={() => setTab('history')}
          >
            History
          </button>
          <button
            className={tab === 'settings' ? 'tab active' : 'tab'}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
        </nav>
        {window.api ? (
          <button
            className="quit-btn"
            title="Quit Vocab"
            onClick={() => window.api?.quit()}
          >
            ✕
          </button>
        ) : null}
      </header>

      <main className="app-body">
        {tab === 'lookup' && <LookupView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

export function App(): JSX.Element {
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.api) {
      document.documentElement.classList.add('web')
    }
  }, [])

  return (
    <AuthProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </AuthProvider>
  )
}
