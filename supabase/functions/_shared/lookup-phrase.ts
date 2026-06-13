// Prompt + tool definition for the lookup-phrase function: explains a phrase /
// idiom given on its own, so the meaning is the most common one, not contextual.

import { languageName } from './languages.ts'
import type { ToolDefinition } from './claude.ts'

export const MAX_TOKENS = 700
export const TOOL_NAME = 'record_phrase_lookup'

export function buildSystemPrompt(language: string): string {
  const name = languageName(language)
  return `You are a vocabulary tutor helping a reader understand a ${name} idiom, fixed expression, or short phrase.

The reader will give you a phrase on its own, with no surrounding context. Because there is no context, explain its most common, widely-understood meaning — the sense a native speaker would assume first.

Write everything you return entirely in ${name}. Do not translate into any other language and do not mix languages — the classification, explanation, synonyms and examples must all be in ${name}.

Use the record_phrase_lookup tool to return:
- word_class: How to classify the phrase, written in ${name} and lowercase (for example, in English: "idiom", "phrase", "phrasal verb", "collocation", "proverb"; use the equivalent terms in ${name}). Pick the single best fit.
- explanation: 2 to 4 sentences in ${name} explaining the phrase's most common meaning. If it is figurative or idiomatic, make that clear. Clear and simple.
- synonyms: 3 to 5 equivalent ${name} expressions or short paraphrases that capture the same meaning. Prefer common ones.
- examples: 1 or 2 short, natural ${name} example sentences that use the phrase with that meaning.`
}

export const TOOL: ToolDefinition = {
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

export function buildUserMessage(phrase: string): string {
  return `Phrase or idiom to explain: "${phrase}"`
}
