import type { ApiResult, Lookup, LookupRequest } from '@shared/types'
import { supabase } from './supabase'

interface LookupRow {
  id: string
  word: string
  paragraph: string
  explanation: string
  synonyms: string[] | null
  examples: string[] | null
  created_at: string
}

function rowToLookup(row: LookupRow): Lookup {
  return {
    id: row.id,
    word: row.word,
    paragraph: row.paragraph,
    explanation: row.explanation,
    synonyms: row.synonyms ?? [],
    examples: row.examples ?? [],
    createdAt: row.created_at
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

  const { data, error } = await supabase.functions.invoke<LookupRow>('lookup-word', {
    body: { word, paragraph }
  })

  if (error) return fail(error)
  if (!data) return fail('Empty response from server.')
  return { ok: true, data: rowToLookup(data) }
}

export interface ListHistoryOptions {
  search?: string
  before?: string // ISO timestamp; returns rows older than this
  limit?: number
}

export async function listHistory(
  opts: ListHistoryOptions = {}
): Promise<ApiResult<Lookup[]>> {
  const limit = opts.limit ?? 20
  try {
    let query = supabase
      .from('lookups')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (opts.before) {
      query = query.lt('created_at', opts.before)
    }

    const q = opts.search?.trim()
    if (q) {
      const safe = q.replace(/[%_]/g, '\\$&')
      query = query.or(`word.ilike.%${safe}%,paragraph.ilike.%${safe}%`)
    }

    const { data, error } = await query
    if (error) return fail(error.message)
    return { ok: true, data: (data ?? []).map(rowToLookup) }
  } catch (e) {
    return fail(e)
  }
}

export async function deleteLookup(id: string): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase.from('lookups').delete().eq('id', id)
    if (error) return fail(error.message)
    return { ok: true, data: undefined }
  } catch (e) {
    return fail(e)
  }
}
