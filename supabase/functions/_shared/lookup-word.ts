// Prompt + tool definition for the lookup-word function: explains a word as it
// is used in a specific paragraph.

import { languageName } from './languages.ts'
import type { ToolDefinition } from './claude.ts'

export const MAX_TOKENS = 700
export const TOOL_NAME = 'record_word_lookup'

export function buildSystemPrompt(language: string): string {
  const name = languageName(language)
  return `You are a vocabulary tutor helping a reader understand a ${name} word they encountered while reading.

The reader will give you:
- a paragraph from a book, written in ${name}
- a word or phrase from that paragraph they don't understand

Write everything you return entirely in ${name}. Do not translate into any other language and do not mix languages — the part of speech, explanation, synonyms and examples must all be in ${name}.

Use the record_word_lookup tool to return:
- word_class: The part of speech of the word as it's used in this paragraph, written in ${name} and lowercase (for example, in English: "noun", "verb", "adjective", "adverb", "phrasal verb", "idiom", "proper noun"; use the equivalent grammatical terms in ${name}). Pick the single best fit for the contextual usage.
- explanation: 2 to 4 sentences in ${name} explaining what the word means *as it is used in this specific paragraph*. Focus on contextual meaning, not generic dictionary definitions. Clear and simple. Don't repeat the paragraph back.
- synonyms: 3 to 5 simple ${name} words or short phrases that capture the same sense the word has in this paragraph. Prefer common words.
- examples: 1 or 2 short, natural ${name} example sentences (not from the original paragraph) that use the word with the same sense.`
}

export const TOOL: ToolDefinition = {
  name: TOOL_NAME,
  description:
    'Record the contextual explanation, synonyms, and example sentences for the word.',
  input_schema: {
    type: 'object',
    properties: {
      word_class: {
        type: 'string',
        description:
          "Part of speech of the word as used in this paragraph. Lowercase, e.g. 'noun', 'verb', 'adjective', 'adverb', 'phrasal verb', 'idiom', 'proper noun'."
      },
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
    required: ['word_class', 'explanation', 'synonyms', 'examples']
  }
}

export function buildUserMessage(word: string, paragraph: string): string {
  return `Paragraph:
<paragraph>
${paragraph}
</paragraph>

Word or phrase to explain: "${word}"`
}
