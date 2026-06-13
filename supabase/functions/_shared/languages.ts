// Supported target languages. Everything we produce stays in this language —
// there is no translation step.
//
// Shared between the Deno edge functions and the local Node dev server, so it
// must stay runtime-agnostic: relative imports only, no Deno/Node globals.

export const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French'
}

export const DEFAULT_LANGUAGE = 'en'

export function languageName(language: string): string {
  return LANGUAGES[language] ?? LANGUAGES[DEFAULT_LANGUAGE]
}

export function resolveLanguage(value: unknown): string {
  return typeof value === 'string' && value in LANGUAGES ? value : DEFAULT_LANGUAGE
}
