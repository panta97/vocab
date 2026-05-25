import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Surfaced at runtime via the sign-in screen — don't throw here so the renderer
  // can still mount and show a useful error.
  console.warn(
    '[vocab] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set. ' +
      'Copy .env.example to .env and fill in values.'
  )
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
)

export const supabaseConfigured = Boolean(url && anonKey)
