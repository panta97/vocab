import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'
import { clearCache as clearHistoryCache } from './historyCache'

interface AuthState {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  signOut: async () => {}
})

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    clearHistoryCache()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function AuthGate({ children }: { children: React.ReactNode }): JSX.Element {
  const { session, loading } = useAuth()

  if (!supabaseConfigured) {
    return (
      <div className="auth-screen">
        <h1>Setup needed</h1>
        <p className="muted">
          Supabase credentials are not configured. Copy <code>.env.example</code> to{' '}
          <code>.env</code> at the project root and fill in{' '}
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then
          restart the app.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="auth-screen"><div className="muted">Loading…</div></div>
  }

  if (!session) return <SignIn />
  return <>{children}</>
}

function SignIn(): JSX.Element {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'enter-email' | 'enter-code'>('enter-email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function sendCode(): Promise<void> {
    setErr(null)
    setMsg(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setStage('enter-code')
    setMsg('Check your email for a 6-digit code.')
  }

  async function verify(): Promise<void> {
    setErr(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email'
    })
    setBusy(false)
    if (error) setErr(error.message)
  }

  return (
    <div className="auth-screen">
      <h1>Vocab</h1>
      <p className="muted">Sign in to sync your lookups across devices.</p>

      {stage === 'enter-email' ? (
        <>
          <input
            className="key-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <button
            className="primary"
            onClick={() => void sendCode()}
            disabled={busy || !email.trim()}
          >
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            Sent to <strong>{email}</strong>
          </p>
          <input
            className="key-input"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <button
            className="primary"
            onClick={() => void verify()}
            disabled={busy || code.trim().length < 6}
          >
            {busy ? 'Verifying…' : 'Verify'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setStage('enter-email')
              setCode('')
              setMsg(null)
              setErr(null)
            }}
            disabled={busy}
          >
            Use different email
          </button>
        </>
      )}

      {msg && <div className="banner ok">{msg}</div>}
      {err && <div className="banner error">{err}</div>}
    </div>
  )
}
