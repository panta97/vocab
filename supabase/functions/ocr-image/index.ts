// Supabase Edge Function: ocr-image
// POST { image (base64, no data: prefix), mediaType, language } → calls Claude
// vision, returns { text } with the text read from the image.
// We never store the uploaded image — only the extracted text is returned.
//
// Prompt and constraints live in ../_shared so the local dev server
// (dev-server/) stays in lockstep with what we deploy.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1'

import { MODEL, extractTextContent } from '../_shared/claude.ts'
import { resolveLanguage } from '../_shared/languages.ts'
import {
  ALLOWED_MEDIA_TYPES,
  MAX_TOKENS,
  USER_INSTRUCTION,
  buildSystemPrompt
} from '../_shared/ocr.ts'

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
  const language = resolveLanguage(body.language)

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
            { type: 'text', text: USER_INSTRUCTION }
          ]
        }
      ]
    })

    text = extractTextContent(response.content)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(502, `OCR failed: ${msg}`)
  }

  return new Response(JSON.stringify({ text }), { headers: JSON_HEADERS })
})
