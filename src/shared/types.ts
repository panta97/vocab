// Target languages we support. A lookup is fully authored in one of these —
// we never translate between them.
export type Language = 'en' | 'es' | 'fr'

// A lookup is either a single 'word' explained in the context of a paragraph,
// or a standalone 'phrase'/idiom explained by its most common meaning.
export type LookupType = 'word' | 'phrase'

export interface Lookup {
  id: string
  type: LookupType
  // The headword: the looked-up word, or the whole phrase/idiom.
  term: string
  wordClass: string
  // Source context for word lookups; empty for standalone phrases.
  paragraph: string
  explanation: string
  synonyms: string[]
  examples: string[]
  // Origin / history of the term. Empty until generated on demand.
  etymology: string
  language: Language
  createdAt: string
}

export interface LookupRequest {
  word: string
  paragraph: string
  language: Language
}

// A phrase is pasted on its own — no paragraph, so we explain its most common
// meaning rather than a contextual one.
export interface PhraseLookupRequest {
  phrase: string
  language: Language
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Tiny remaining surface exposed by the Electron main process to the renderer.
// Data lives in Supabase now; this is just OS integration.
export interface MainApi {
  quit: () => Promise<void>
}
