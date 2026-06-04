// Supabase Edge Function: lookup-phrase
// POST { phrase, language } → calls Claude for the phrase's most common meaning,
// inserts a row in `lookups` (type 'phrase', no paragraph), returns the row.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 700
const TOOL_NAME = 'record_phrase_lookup'

// Supported target languages. Everything we produce stays in this language —
// there is no translation step.
const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French'
}
const DEFAULT_LANGUAGE = 'en'

function buildSystemPrompt(language: string): string {
  const name = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE]
  return `You are a vocabulary tutor helping a reader understand a ${name} idiom, fixed expression, or short phrase.

The reader will give you a phrase on its own, with no surrounding context. Because there is no context, explain its most common, widely-understood meaning — the sense a native speaker would assume first.

Write everything you return entirely in ${name}. Do not translate into any other language and do not mix languages — the classification, explanation, synonyms and examples must all be in ${name}.

Use the record_phrase_lookup tool to return:
- word_class: How to classify the phrase, written in ${name} and lowercase (for example, in English: "idiom", "phrase", "phrasal verb", "collocation", "proverb"; use the equivalent terms in ${name}). Pick the single best fit.
- explanation: 2 to 4 sentences in ${name} explaining the phrase's most common meaning. If it is figurative or idiomatic, make that clear. Clear and simple.
- synonyms: 3 to 5 equivalent ${name} expressions or short paraphrases that capture the same meaning. Prefer common ones.
- examples: 1 or 2 short, natural ${name} example sentences that use the phrase with that meaning.`
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

  // Client scoped to the caller's JWT — RLS will enforce user isolation on insert.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser()
  if (userErr || !user) return jsonError(401, 'Invalid session')

  let body: { phrase?: unknown; language?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const phrase = typeof body.phrase === 'string' ? body.phrase.trim() : ''
  const language =
    typeof body.language === 'string' && body.language in LANGUAGES
      ? body.language
      : DEFAULT_LANGUAGE
  if (!phrase) return jsonError(400, 'phrase is required')

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const userMessage = `Phrase or idiom to explain: "${phrase}"`

  let explanation = ''
  let wordClass = ''
  let synonyms: string[] = []
  let examples: string[] = []

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(language),
      tools: [
        {
          name: TOOL_NAME,
          description:
            'Record the most common meaning, equivalent expressions, and example sentences for the phrase.',
          input_schema: {
            type: 'object',
            properties: {
              word_class: {
                type: 'string',
                description:
                  "How to classify the phrase. Lowercase, e.g. 'idiom', 'phrase', 'phrasal verb', 'collocation', 'proverb'."
              },
              explanation: {
                type: 'string',
                description:
                  "2 to 4 sentences explaining the phrase's most common meaning."
              },
              synonyms: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Three to five equivalent expressions or short paraphrases with the same meaning.'
              },
              examples: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'One or two short example sentences using the phrase with that meaning.'
              }
            },
            required: ['word_class', 'explanation', 'synonyms', 'examples']
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

    const input = toolUse.input
    wordClass = String(input.word_class ?? '').trim().toLowerCase()
    explanation = String(input.explanation ?? '').trim()
    synonyms = Array.isArray(input.synonyms)
      ? input.synonyms.map((s) => String(s).trim()).filter(Boolean)
      : []
    examples = Array.isArray(input.examples)
      ? input.examples.map((s) => String(s).trim()).filter(Boolean)
      : []

    if (!explanation) return jsonError(502, 'Claude returned an empty explanation')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(502, `Claude call failed: ${msg}`)
  }

  const { data: row, error: insertErr } = await supabase
    .from('lookups')
    .insert({
      user_id: user.id,
      type: 'phrase',
      term: phrase,
      word_class: wordClass,
      paragraph: '',
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
