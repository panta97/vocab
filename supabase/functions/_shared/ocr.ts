// Prompt + constraints for the ocr-image function: transcribes the text in an
// image via Claude vision. No tool — the response is plain text.

import { languageName } from './languages.ts'

export const MAX_TOKENS = 2000

// Image media types Claude vision accepts.
export const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
])

export function buildSystemPrompt(language: string): string {
  const name = languageName(language)
  return `You extract text from images of book pages, screenshots, and photos for a reader.

The text in the image is most likely written in ${name} — use that as a hint to read ambiguous characters and accents correctly, but transcribe whatever language actually appears.

Rules:
- Transcribe the text exactly as written. Do not translate, summarize, correct, or add commentary.
- Preserve the natural paragraph breaks. Join lines that are only wrapped mid-sentence into a single paragraph.
- If the image contains no readable text, return an empty string.
- Output only the transcribed text — no preamble, labels, or quotation marks.`
}

export const USER_INSTRUCTION =
  'Transcribe all the text in this image following your instructions.'
