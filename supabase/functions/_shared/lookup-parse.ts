// Parsing of the tool input returned by Claude for word and phrase lookups —
// both tools share the same output fields.

export interface ParsedLookup {
  wordClass: string
  explanation: string
  synonyms: string[]
  examples: string[]
}

export function parseLookupInput(input: Record<string, unknown>): ParsedLookup {
  return {
    wordClass: String(input.word_class ?? '').trim().toLowerCase(),
    explanation: String(input.explanation ?? '').trim(),
    synonyms: Array.isArray(input.synonyms)
      ? input.synonyms.map((s) => String(s).trim()).filter(Boolean)
      : [],
    examples: Array.isArray(input.examples)
      ? input.examples.map((s) => String(s).trim()).filter(Boolean)
      : []
  }
}
