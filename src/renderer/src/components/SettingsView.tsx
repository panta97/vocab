import { useAuth } from '../lib/auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined

function projectDashboardUrl(): string | null {
  if (!SUPABASE_URL) return null
  try {
    const host = new URL(SUPABASE_URL).host
    const ref = host.split('.')[0]
    return `https://supabase.com/dashboard/project/${ref}`
  } catch {
    return null
  }
}

export function SettingsView(): JSX.Element {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? '—'
  const dashboard = projectDashboardUrl()

  return (
    <div className="settings">
      <h2>Account</h2>
      <p className="muted">Lookups sync to your Supabase project.</p>
      <div className="status">
        Signed in as <strong>{email}</strong>
      </div>
      <div className="row">
        <button className="secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <h2 style={{ marginTop: 12 }}>Database</h2>
      <p className="muted">Inspect your data in the Supabase Table Editor.</p>
      {dashboard ? (
        <a className="link mono" href={dashboard} target="_blank" rel="noreferrer">
          {dashboard}
        </a>
      ) : (
        <div className="muted small">Set VITE_SUPABASE_URL to see the dashboard link.</div>
      )}
    </div>
  )
}
