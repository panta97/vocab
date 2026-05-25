export interface Lookup {
  id: string
  word: string
  wordClass: string
  paragraph: string
  explanation: string
  synonyms: string[]
  examples: string[]
  createdAt: string
}

export interface LookupRequest {
  word: string
  paragraph: string
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Tiny remaining surface exposed by the Electron main process to the renderer.
// Data lives in Supabase now; this is just OS integration.
export interface MainApi {
  quit: () => Promise<void>
}
