// Local dev server: stands in for the Supabase backend (edge functions + the
// lookups table) so the app can run fully locally. Prompts/tool schemas are
// imported from supabase/functions/_shared — the same modules the deployed
// edge functions use — so local behavior tracks prod.
//
// Run with: npm run dev:server   (or npm run dev:local for server + app)

import { readFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

import {
  MODEL,
  extractTextContent,
  extractToolInput,
  type ToolDefinition
} from '../supabase/functions/_shared/claude.ts'
import { resolveLanguage } from '../supabase/functions/_shared/languages.ts'
import { parseLookupInput } from '../supabase/functions/_shared/lookup-parse.ts'
import * as wordPrompts from '../supabase/functions/_shared/lookup-word.ts'
import * as phrasePrompts from '../supabase/functions/_shared/lookup-phrase.ts'
import * as etymologyPrompts from '../supabase/functions/_shared/etymology.ts'
import * as ocrPrompts from '../supabase/functions/_shared/ocr.ts'
import {
  bootstrap,
  deleteLookup,
  getLookup,
  insertLookup,
  listLookups,
  setEtymology
} from './db.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8787)
// Base64 OCR payloads for an 8 MB image are ~11 MB; leave headroom.
const MAX_BODY_BYTES = 16 * 1024 * 1024

function loadAnthropicKey(): string {
  try {
    const key = readFileSync(join(HERE, '..', '.api-key'), 'utf8').trim()
    if (key) return key
  } catch {
    // fall through to env
  }
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim()
  if (fromEnv) return fromEnv
  console.error(
    '[dev-server] No Anthropic API key. Put it in .api-key at the repo root ' +
      'or set ANTHROPIC_API_KEY.'
  )
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: loadAnthropicKey() })

// Our structural ToolDefinition matches what the API accepts; the SDK's Tool
// type is just stricter about input_schema.
const asTools = (tool: ToolDefinition): Anthropic.Tool[] => [tool as Anthropic.Tool]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS })
  res.end(JSON.stringify(body))
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message })
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleLookupWord(body: Record<string, unknown>, res: http.ServerResponse) {
  const word = typeof body.word === 'string' ? body.word.trim() : ''
  const paragraph = typeof body.paragraph === 'string' ? body.paragraph.trim() : ''
  const language = resolveLanguage(body.language)
  if (!word) return sendError(res, 400, 'word is required')
  if (!paragraph) return sendError(res, 400, 'paragraph is required')

  let parsed
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: wordPrompts.MAX_TOKENS,
      system: wordPrompts.buildSystemPrompt(language),
      tools: asTools(wordPrompts.TOOL),
      tool_choice: { type: 'tool', name: wordPrompts.TOOL_NAME },
      messages: [{ role: 'user', content: wordPrompts.buildUserMessage(word, paragraph) }]
    })
    const input = extractToolInput(response.content)
    if (!input) return sendError(res, 502, 'Claude did not return a structured response')
    parsed = parseLookupInput(input)
    if (!parsed.explanation) return sendError(res, 502, 'Claude returned an empty explanation')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return sendError(res, 502, `Claude call failed: ${msg}`)
  }

  const row = await insertLookup({
    type: 'word',
    term: word,
    wordClass: parsed.wordClass,
    paragraph,
    explanation: parsed.explanation,
    synonyms: parsed.synonyms,
    examples: parsed.examples,
    language
  })
  sendJson(res, 200, row)
}

async function handleLookupPhrase(body: Record<string, unknown>, res: http.ServerResponse) {
  const phrase = typeof body.phrase === 'string' ? body.phrase.trim() : ''
  const language = resolveLanguage(body.language)
  if (!phrase) return sendError(res, 400, 'phrase is required')

  let parsed
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: phrasePrompts.MAX_TOKENS,
      system: phrasePrompts.buildSystemPrompt(language),
      tools: asTools(phrasePrompts.TOOL),
      tool_choice: { type: 'tool', name: phrasePrompts.TOOL_NAME },
      messages: [{ role: 'user', content: phrasePrompts.buildUserMessage(phrase) }]
    })
    const input = extractToolInput(response.content)
    if (!input) return sendError(res, 502, 'Claude did not return a structured response')
    parsed = parseLookupInput(input)
    if (!parsed.explanation) return sendError(res, 502, 'Claude returned an empty explanation')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return sendError(res, 502, `Claude call failed: ${msg}`)
  }

  const row = await insertLookup({
    type: 'phrase',
    term: phrase,
    wordClass: parsed.wordClass,
    paragraph: '',
    explanation: parsed.explanation,
    synonyms: parsed.synonyms,
    examples: parsed.examples,
    language
  })
  sendJson(res, 200, row)
}

async function handleEtymology(body: Record<string, unknown>, res: http.ServerResponse) {
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  if (!id) return sendError(res, 400, 'id is required')

  const lookup = await getLookup(id)
  if (!lookup) return sendError(res, 404, 'Lookup not found')

  // Idempotent: if it already has an etymology, return it unchanged (no re-spend).
  if (lookup.etymology.trim()) return sendJson(res, 200, lookup)

  const language = resolveLanguage(lookup.language)
  const isPhrase = lookup.type === 'phrase'

  let etymology = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: etymologyPrompts.MAX_TOKENS,
      system: etymologyPrompts.buildSystemPrompt(language, isPhrase),
      tools: asTools(etymologyPrompts.TOOL),
      tool_choice: { type: 'tool', name: etymologyPrompts.TOOL_NAME },
      messages: [{ role: 'user', content: etymologyPrompts.buildUserMessage(lookup.term) }]
    })
    const input = extractToolInput(response.content)
    if (!input) return sendError(res, 502, 'Claude did not return a structured response')
    etymology = String(input.etymology ?? '').trim()
    if (!etymology) return sendError(res, 502, 'Claude returned an empty etymology')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return sendError(res, 502, `Claude call failed: ${msg}`)
  }

  const row = await setEtymology(id, etymology)
  if (!row) return sendError(res, 404, 'Lookup not found')
  sendJson(res, 200, row)
}

async function handleOcrImage(body: Record<string, unknown>, res: http.ServerResponse) {
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : ''
  const language = resolveLanguage(body.language)

  if (!image) return sendError(res, 400, 'image is required')
  if (!ocrPrompts.ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return sendError(res, 400, `Unsupported image type: ${mediaType || 'unknown'}`)
  }

  let text = ''
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: ocrPrompts.MAX_TOKENS,
      system: ocrPrompts.buildSystemPrompt(language),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                data: image
              }
            },
            { type: 'text', text: ocrPrompts.USER_INSTRUCTION }
          ]
        }
      ]
    })
    text = extractTextContent(response.content)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return sendError(res, 502, `OCR failed: ${msg}`)
  }

  sendJson(res, 200, { text })
}

async function handleListHistory(url: URL, res: http.ServerResponse) {
  const rawLimit = Number(url.searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 20
  try {
    const rows = await listLookups({
      language: url.searchParams.get('language') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      before: url.searchParams.get('before') ?? undefined,
      search: url.searchParams.get('search')?.trim() || undefined,
      limit
    })
    sendJson(res, 200, rows)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    sendError(res, 400, `History query failed: ${msg}`)
  }
}

const POST_ROUTES: Record<
  string,
  (body: Record<string, unknown>, res: http.ServerResponse) => Promise<void>
> = {
  '/functions/lookup-word': handleLookupWord,
  '/functions/lookup-phrase': handleLookupPhrase,
  '/functions/etymology': handleEtymology,
  '/functions/ocr-image': handleOcrImage
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    if (req.method === 'POST' && POST_ROUTES[url.pathname]) {
      let body: Record<string, unknown>
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        return sendError(res, 400, 'Invalid JSON body')
      }
      await POST_ROUTES[url.pathname](body, res)
      return
    }

    if (req.method === 'GET' && url.pathname === '/history') {
      await handleListHistory(url, res)
      return
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/history/')) {
      const id = decodeURIComponent(url.pathname.slice('/history/'.length))
      if (!id) return sendError(res, 400, 'id is required')
      try {
        await deleteLookup(id)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return sendError(res, 400, `Delete failed: ${msg}`)
      }
      sendJson(res, 200, { ok: true })
      return
    }

    sendError(res, 404, `No route for ${req.method} ${url.pathname}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    sendError(res, 500, msg)
  }
})

async function main(): Promise<void> {
  await bootstrap()
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[dev-server] listening on http://127.0.0.1:${PORT}`)
  })
}

main().catch((e) => {
  console.error('[dev-server]', e instanceof Error ? e.message : e)
  process.exit(1)
})
