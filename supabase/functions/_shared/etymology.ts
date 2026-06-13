// Prompt + tool definition for the etymology function: traces the origin of a
// previously looked-up word or phrase, in the lookup's own language.

import { languageName } from './languages.ts'
import type { ToolDefinition } from './claude.ts'

export const MAX_TOKENS = 600
export const TOOL_NAME = 'record_etymology'

export function buildSystemPrompt(language: string, isPhrase: boolean): string {
  const name = languageName(language)
  const focus = isPhrase
    ? `The term is a phrase or expression. Trace its origin, focusing on its key or most distinctive word(s) and how the whole expression came to mean what it does.`
    : `Trace the origin of the word: its roots and components, and how its current meaning developed.`
  return `You are an etymologist explaining where a ${name} word or expression comes from.

Write everything entirely in ${name}. Do not translate into any other language and do not mix languages.

${focus}

Use the record_etymology tool to return a concise etymology of 2 to 5 sentences: the origin and component parts, and how the meaning evolved, with approximate dates or periods where they are known. Keep it factual and readable. If the origin is genuinely uncertain or disputed, say so briefly rather than inventing details.`
}

export const TOOL: ToolDefinition = {
  name: TOOL_NAME,
  description: 'Record the etymology / origin of the term.',
  input_schema: {
    type: 'object',
    properties: {
      etymology: {
        type: 'string',
        description:
          "2 to 5 sentences on the term's origin, components, and how its meaning developed, with approximate dates where known."
      }
    },
    required: ['etymology']
  }
}

export function buildUserMessage(term: string): string {
  return `Term to trace: "${term}"`
}
