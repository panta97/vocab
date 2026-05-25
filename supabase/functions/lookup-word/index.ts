// Supabase Edge Function: lookup-word
// POST { word, paragraph } → calls Claude, inserts row in `lookups`, returns the inserted row.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 700
const TOOL_NAME = 'record_word_lookup'

const SYSTEM_PROMPT = `You are a vocabulary tutor helping a reader understand an English word they encountered while reading.

The reader will give you:
- a paragraph from a book
- a word or phrase from that paragraph they don't understand

Use the record_word_lookup tool to return:
- explanation: 2 to 4 sentences explaining what the word means *as it is used in this specific paragraph*. Focus on contextual meaning, not generic dictionary definitions. Clear, simple English. Don't repeat the paragraph back.
- synonyms: 3 to 5 simple words or short phrases that capture the same sense the word has in this paragraph. Prefer common words.
- examples: 1 or 2 short, natural example sentences (not from the original paragraph) that use the word with the same sense.`

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

  let body: { word?: unknown; paragraph?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const word = typeof body.word === 'string' ? body.word.trim() : ''
  const paragraph = typeof body.paragraph === 'string' ? body.paragraph.trim() : ''
  if (!word) return jsonError(400, 'word is required')
  if (!paragraph) return jsonError(400, 'paragraph is required')

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const userMessage = `Paragraph:
<paragraph>
${paragraph}
</paragraph>

Word or phrase to explain: "${word}"`

  let explanation = ''
  let synonyms: string[] = []
  let examples: string[] = []

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description:
            'Record the contextual explanation, synonyms, and example sentences for the word.',
          input_schema: {
            type: 'object',
            properties: {
              explanation: {
                type: 'string',
                description:
                  "2 to 4 sentences explaining the word's meaning in this paragraph."
              },
              synonyms: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'Three to five simple synonyms or similar words matching the contextual sense.'
              },
              examples: {
                type: 'array',
                items: { type: 'string' },
                description:
                  'One or two short example sentences using the word in the same sense.'
              }
            },
            required: ['explanation', 'synonyms', 'examples']
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
      word,
      paragraph,
      explanation,
      synonyms,
      examples
    })
    .select()
    .single()

  if (insertErr) return jsonError(500, `Insert failed: ${insertErr.message}`)

  return new Response(JSON.stringify(row), { headers: JSON_HEADERS })
})
