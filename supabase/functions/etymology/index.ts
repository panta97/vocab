// Supabase Edge Function: etymology
// POST { id } → loads the lookup, asks Claude for the term's origin/history,
// stores it on the row's `etymology` column, and returns the updated row.
//
// Prompt, tool schema, and parsing live in ../_shared so the local dev server
// (dev-server/) stays in lockstep with what we deploy.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

import { MODEL, extractToolInput } from '../_shared/claude.ts'
import { resolveLanguage } from '../_shared/languages.ts'
import {
  MAX_TOKENS,
  TOOL,
  TOOL_NAME,
  buildSystemPrompt,
  buildUserMessage
} from '../_shared/etymology.ts'

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

  // Client scoped to the caller's JWT — RLS enforces user isolation on read/write.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser()
  if (userErr || !user) return jsonError(401, 'Invalid session')

  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return jsonError(400, 'id is required')

  // Load the lookup (RLS guarantees it belongs to the caller).
  const { data: lookup, error: loadErr } = await supabase
    .from('lookups')
    .select('*')
    .eq('id', id)
    .single()
  if (loadErr || !lookup) return jsonError(404, 'Lookup not found')

  // Idempotent: if it already has an etymology, return it unchanged (no re-spend).
  if (typeof lookup.etymology === 'string' && lookup.etymology.trim()) {
    return new Response(JSON.stringify(lookup), { headers: JSON_HEADERS })
  }

  const language = resolveLanguage(lookup.language)
  const isPhrase = lookup.type === 'phrase'

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let etymology = ''

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(language, isPhrase),
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildUserMessage(lookup.term) }]
    })

    const input = extractToolInput(response.content)
    if (!input) return jsonError(502, 'Claude did not return a structured response')

    etymology = String(input.etymology ?? '').trim()
    if (!etymology) return jsonError(502, 'Claude returned an empty etymology')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(502, `Claude call failed: ${msg}`)
  }

  const { data: row, error: updateErr } = await supabase
    .from('lookups')
    .update({ etymology })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return jsonError(500, `Update failed: ${updateErr.message}`)

  return new Response(JSON.stringify(row), { headers: JSON_HEADERS })
})
