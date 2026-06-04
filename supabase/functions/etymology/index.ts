// Supabase Edge Function: etymology
// POST { id } → loads the lookup, asks Claude for the term's origin/history,
// stores it on the row's `etymology` column, and returns the updated row.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 600
const TOOL_NAME = 'record_etymology'

// Supported target languages. The etymology is written in the lookup's own
// language — there is no translation step.
const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French'
}
const DEFAULT_LANGUAGE = 'en'

function buildSystemPrompt(language: string, isPhrase: boolean): string {
  const name = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE]
  const focus = isPhrase
    ? `The term is a phrase or expression. Trace its origin, focusing on its key or most distinctive word(s) and how the whole expression came to mean what it does.`
    : `Trace the origin of the word: its roots and components, and how its current meaning developed.`
  return `You are an etymologist explaining where a ${name} word or expression comes from.

Write everything entirely in ${name}. Do not translate into any other language and do not mix languages.

${focus}

Use the record_etymology tool to return a concise etymology of 2 to 5 sentences: the origin and component parts, and how the meaning evolved, with approximate dates or periods where they are known. Keep it factual and readable. If the origin is genuinely uncertain or disputed, say so briefly rather than inventing details.`
}

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

  const language =
    typeof lookup.language === 'string' && lookup.language in LANGUAGES
      ? lookup.language
      : DEFAULT_LANGUAGE
  const isPhrase = lookup.type === 'phrase'

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const userMessage = `Term to trace: "${lookup.term}"`

  let etymology = ''

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(language, isPhrase),
      tools: [
        {
          name: TOOL_NAME,
          description: 'Record the etymology / origin of the term.',
          input_schema: {
            type: 'object',
            properties: {
              etymology: {
                type: 'string',
                description:
                  "2 to 5 sentences on the term's origin, components, and how its meaning developed, with approximate dates where known."
              }
            },
            required: ['etymology']
          }
        }
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: userMessage }]
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use') as
      | { type: 'tool_use'; input: Record<string, unknown> }
      | undefined
    if (!toolUse) return jsonError(502, 'Claude did not return a structured response')

    etymology = String(toolUse.input.etymology ?? '').trim()
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
