// Supabase Edge Function: ocr-image
// POST { image (base64, no data: prefix), mediaType, language } → calls Claude
// vision, returns { text } with the text read from the image.
// We never store the uploaded image — only the extracted text is returned.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2000

// Languages we can hint Claude with. Matches the front-end target languages.
const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French'
}
const DEFAULT_LANGUAGE = 'en'

// Image media types Claude vision accepts.
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

function buildSystemPrompt(language: string): string {
  const name = LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE]
  return `You extract text from images of book pages, screenshots, and photos for a reader.

The text in the image is most likely written in ${name} — use that as a hint to read ambiguous characters and accents correctly, but transcribe whatever language actually appears.

Rules:
- Transcribe the text exactly as written. Do not translate, summarize, correct, or add commentary.
- Preserve the natural paragraph breaks. Join lines that are only wrapped mid-sentence into a single paragraph.
- If the image contains no readable text, return an empty string.
- Output only the transcribed text — no preamble, labels, or quotation marks.`
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

  // Client scoped to the caller's JWT — only authenticated users may OCR.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })

  const {
    data: { user },
    error: userErr
  } = await supabase.auth.getUser()
  if (userErr || !user) return jsonError(401, 'Invalid session')

  let body: { image?: unknown; mediaType?: unknown; language?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'Invalid JSON body')
  }

  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : ''
  const language =
    typeof body.language === 'string' && body.language in LANGUAGES
      ? body.language
      : DEFAULT_LANGUAGE

  if (!image) return jsonError(400, 'image is required')
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return jsonError(400, `Unsupported image type: ${mediaType || 'unknown'}`)
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let text = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(language),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/webp'
                  | 'image/gif',
                data: image
              }
            },
            {
              type: 'text',
              text: 'Transcribe all the text in this image following your instructions.'
            }
          ]
        }
      ]
    })

    text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(502, `OCR failed: ${msg}`)
  }

  return new Response(JSON.stringify({ text }), { headers: JSON_HEADERS })
})
