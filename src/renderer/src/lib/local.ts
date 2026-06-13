// Local dev mode: when VITE_LOCAL_API_URL is set (see .env.development.local),
// api.ts talks to the local dev server (dev-server/) instead of Supabase, and
// auth.tsx skips sign-in with a fixed local user. The flag only exists in Vite
// mode `development`, so packaged/production builds can never enter local mode.

export const LOCAL_API_URL: string | undefined = import.meta.env.DEV
  ? (import.meta.env.VITE_LOCAL_API_URL as string | undefined)
  : undefined

export const LOCAL_MODE = Boolean(LOCAL_API_URL)

// Must match LOCAL_USER_ID in dev-server/db.ts and auth-shim.sql.
export const LOCAL_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'local@dev'
}

// Same shape as supabase.functions.invoke's return value so api.ts call sites
// can branch between the two transports without further mapping.
interface InvokeResult<T> {
  data: T | null
  error: Error | null
}

async function request<T>(path: string, init?: RequestInit): Promise<InvokeResult<T>> {
  try {
    const res = await fetch(`${LOCAL_API_URL}${path}`, init)
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const message =
        body && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `Local API error (${res.status})`
      return { data: null, error: new Error(message) }
    }
    return { data: body as T, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      data: null,
      error: new Error(
        `Local dev server unreachable at ${LOCAL_API_URL} — is \`npm run dev:server\` running? (${msg})`
      )
    }
  }
}

export function localInvoke<T>(name: string, body: unknown): Promise<InvokeResult<T>> {
  return request<T>(`/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function localListHistory<T>(opts: {
  search?: string
  before?: string
  offset?: number
  limit: number
  language?: string
  type?: string
  sort?: string
}): Promise<InvokeResult<T[]>> {
  const params = new URLSearchParams()
  params.set('limit', String(opts.limit))
  if (opts.language) params.set('language', opts.language)
  if (opts.type) params.set('type', opts.type)
  if (opts.before) params.set('before', opts.before)
  if (opts.offset) params.set('offset', String(opts.offset))
  if (opts.sort) params.set('sort', opts.sort)
  if (opts.search?.trim()) params.set('search', opts.search.trim())
  return request<T[]>(`/history?${params.toString()}`)
}

// Stands in for the increment_relevance RPC from migration 0007.
export function localIncrementRelevance(id: string): Promise<InvokeResult<unknown>> {
  return request<unknown>(`/history/${encodeURIComponent(id)}/relevance`, {
    method: 'POST'
  })
}

export function localDeleteLookup(id: string): Promise<InvokeResult<{ ok: boolean }>> {
  return request<{ ok: boolean }>(`/history/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}
