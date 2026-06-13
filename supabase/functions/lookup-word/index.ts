// Supabase Edge Function: lookup-word
// POST { word, paragraph } → calls Claude, inserts row in `lookups`, returns the inserted row.
//
// Prompt, tool schema, and parsing live in ../_shared so the local dev server
// (dev-server/) stays in lockstep with what we deploy.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

import { MODEL, extractToolInput } from '../_shared/claude.ts'
import { resolveLanguage } from '../_shared/languages.ts'
import { parseLookupInput } from '../_shared/lookup-parse.ts'
import {
  MAX_TOKENS,
  TOOL,
  TOOL_NAME,
  buildSystemPrompt,
  buildUserMessage
} from '../_shared/lookup-word.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS }

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonError(405, 'POST only')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError(401, 'Missing Authorization header')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!supabaseUrl || !anonKey || !anthropicKey) {
    return jsonError(500, 'Function missing required environment variables.')
  }

  // Client scoped to the caller's JWT — RLS will enforce user isolation on insert.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser()
  if (userErr || !user) return jsonError(401, 'Invalid session')

  let body: { word?: unknown; paragraph?: unknown; language?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const word = typeof body.word === 'string' ? body.word.trim() : ''
  const paragraph = typeof body.paragraph === 'string' ? body.paragraph.trim() : ''
  const language = resolveLanguage(body.language)
  if (!word) return jsonError(400, 'word is required')
  if (!paragraph) return jsonError(400, 'paragraph is required')

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let explanation = ''
  let wordClass = ''
  let synonyms: string[] = []
  let examples: string[] = []

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(language),
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildUserMessage(word, paragraph) }]
    })

    const input = extractToolInput(response.content)
    if (!input) return jsonError(502, 'Claude did not return a structured response')

    const parsed = parseLookupInput(input)
    wordClass = parsed.wordClass
    explanation = parsed.explanation
    synonyms = parsed.synonyms
    examples = parsed.examples

    if (!explanation) return jsonError(502, 'Claude returned an empty explanation')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(502, `Claude call failed: ${msg}`)
  }

  const { data: row, error: insertErr } = await supabase
    .from('lookups')
    .insert({
      user_id: user.id,
      type: 'word',
      term: word,
      word_class: wordClass,
      paragraph,
      explanation,
      synonyms,
      examples,
      language
    })
    .select()
    .single()

  if (insertErr) return jsonError(500, `Insert failed: ${insertErr.message}`)

  return new Response(JSON.stringify(row), { headers: JSON_HEADERS })
})
