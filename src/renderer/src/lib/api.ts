import type {
  ApiResult,
  Language,
  Lookup,
  LookupRequest,
  LookupType,
  PhraseLookupRequest
} from '@shared/types'
import { supabase } from './supabase'
import {
  LOCAL_MODE,
  localDeleteLookup,
  localInvoke,
  localListHistory
} from './local'

interface LookupRow {
  id: string
  type: string | null
  term: string
  word_class: string | null
  paragraph: string
  explanation: string
  synonyms: string[] | null
  examples: string[] | null
  etymology: string | null
  language: string | null
  created_at: string
  updated_at: string | null
}

const KNOWN_LANGUAGES: Language[] = ['en', 'es', 'fr']

function toLanguage(value: string | null): Language {
  return KNOWN_LANGUAGES.includes(value as Language) ? (value as Language) : 'en'
}

function toType(value: string | null): LookupType {
  return value === 'phrase' ? 'phrase' : 'word'
}

function rowToLookup(row: LookupRow): Lookup {
  return {
    id: row.id,
    type: toType(row.type),
    term: row.term,
    wordClass: row.word_class ?? '',
    paragraph: row.paragraph,
    explanation: row.explanation,
    synonyms: row.synonyms ?? [],
    examples: row.examples ?? [],
    etymology: row.etymology ?? '',
    language: toLanguage(row.language),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  }
}

function fail(err: unknown): ApiResult<never> {
  const message = err instanceof Error ? err.message : String(err)
  return { ok: false, error: message }
}

export async function lookupWord(req: LookupRequest): Promise<ApiResult<Lookup>> {
  const word = req.word?.trim()
  const paragraph = req.paragraph?.trim()
  if (!word) return fail('Highlight the word you want to look up.')
  if (!paragraph) return fail('Paste a paragraph first.')

  const { data, error } = LOCAL_MODE
    ? await localInvoke<LookupRow>('lookup-word', {
        word,
        paragraph,
        language: req.language
      })
    : await supabase.functions.invoke<LookupRow>('lookup-word', {
        body: { word, paragraph, language: req.language }
      })

  if (error) return fail(error)
  if (!data) return fail('Empty response from server.')
  return { ok: true, data: rowToLookup(data) }
}

// Looks up a standalone phrase / idiom — no paragraph, so the edge function
// returns its most common meaning rather than a contextual one.
export async function lookupPhrase(
  req: PhraseLookupRequest
): Promise<ApiResult<Lookup>> {
  const phrase = req.phrase?.trim()
  if (!phrase) return fail('Enter a phrase or idiom to look up.')

  const { data, error } = LOCAL_MODE
    ? await localInvoke<LookupRow>('lookup-phrase', {
        phrase,
        language: req.language
      })
    : await supabase.functions.invoke<LookupRow>('lookup-phrase', {
        body: { phrase, language: req.language }
      })

  if (error) return fail(error)
  if (!data) return fail('Empty response from server.')
  return { ok: true, data: rowToLookup(data) }
}

// Generates the etymology / origin for an existing lookup and stores it on the
// row, returning the updated lookup. Called on demand from the result card.
export async function generateEtymology(id: string): Promise<ApiResult<Lookup>> {
  if (!id) return fail('Missing lookup id.')

  const { data, error } = LOCAL_MODE
    ? await localInvoke<LookupRow>('etymology', { id })
    : await supabase.functions.invoke<LookupRow>('etymology', { body: { id } })

  if (error) return fail(error)
  if (!data) return fail('Empty response from server.')
  return { ok: true, data: rowToLookup(data) }
}

// Image types our OCR function (Claude vision) accepts.
const OCR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
// Keep payloads small enough for the edge function; base64 inflates ~33%.
const OCR_MAX_BYTES = 8 * 1024 * 1024

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result'))
        return
      }
      // Strip the "data:<mime>;base64," prefix — the function wants raw base64.
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

// Extracts text from an image via the ocr-image edge function. The selected
// language is passed as a hint to improve accuracy. The image itself is never
// stored — only the returned text is used.
export async function extractTextFromImage(
  file: File,
  language: Language
): Promise<ApiResult<string>> {
  if (!OCR_ALLOWED_TYPES.includes(file.type)) {
    return fail('Use a PNG, JPEG, WebP, or GIF image.')
  }
  if (file.size > OCR_MAX_BYTES) {
    return fail('Image is too large (max 8 MB).')
  }

  try {
    const image = await fileToBase64(file)
    const { data, error } = LOCAL_MODE
      ? await localInvoke<{ text: string }>('ocr-image', {
          image,
          mediaType: file.type,
          language
        })
      : await supabase.functions.invoke<{ text: string }>('ocr-image', {
          body: { image, mediaType: file.type, language }
        })
    if (error) return fail(error)
    const text = data?.text?.trim() ?? ''
    if (!text) return fail('No readable text found in that image.')
    return { ok: true, data: text }
  } catch (e) {
    return fail(e)
  }
}

export interface ListHistoryOptions {
  search?: string
  before?: string // ISO timestamp; returns rows older than this
  limit?: number
  language?: Language // when set, only return lookups in this language
  type?: LookupType // when set, only return lookups of this type (word/phrase)
}

export async function listHistory(
  opts: ListHistoryOptions = {}
): Promise<ApiResult<Lookup[]>> {
  const limit = opts.limit ?? 20

  if (LOCAL_MODE) {
    const { data, error } = await localListHistory<LookupRow>({ ...opts, limit })
    if (error) return fail(error)
    return { ok: true, data: (data ?? []).map(rowToLookup) }
  }

  try {
    let query = supabase
      .from('lookups')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (opts.language) {
      query = query.eq('language', opts.language)
    }

    if (opts.type) {
      query = query.eq('type', opts.type)
    }

    if (opts.before) {
      query = query.lt('created_at', opts.before)
    }

    const q = opts.search?.trim()
    if (q) {
      const safe = q.replace(/[%_]/g, '\\$&')
      query = query.or(`term.ilike.%${safe}%,paragraph.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) return fail(error.message)
    return { ok: true, data: (data ?? []).map(rowToLookup) }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteLookup(id: string): Promise<ApiResult<void>> {
  if (LOCAL_MODE) {
    const { error } = await localDeleteLookup(id)
    if (error) return fail(error)
    return { ok: true, data: undefined }
  }

  try {
    const { error } = await supabase.from('lookups').delete().eq('id', id)
    if (error) return fail(error.message)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}
