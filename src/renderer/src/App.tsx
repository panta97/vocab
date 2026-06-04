import { useEffect, useState } from 'react'
import { LookupView } from './components/LookupView'
import { PhraseView } from './components/PhraseView'
import { HistoryView } from './components/HistoryView'
import { SettingsView } from './components/SettingsView'
import { AuthGate, AuthProvider } from './lib/auth'
import { LanguageProvider } from './lib/language'

type Tab = 'lookup' | 'phrases' | 'history' | 'settings'

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
            className={tab === 'phrases' ? 'tab active' : 'tab'}
            onClick={() => setTab('phrases')}
          >
            Phrases
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
        {tab === 'phrases' && <PhraseView />}
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
        <LanguageProvider>
          <Shell />
        </LanguageProvider>
      </AuthGate>
    </AuthProvider>
  )
}
