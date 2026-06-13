// Claude call plumbing shared by the edge functions and the local dev server.
// Tool definitions are typed structurally (not via the SDK) so this file has no
// runtime or SDK dependency — both the Deno and Node Anthropic SDKs accept
// these objects as-is.

export const MODEL = 'claude-sonnet-4-6'

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

// Finds the first tool_use block in a response's `content` array and returns
// its input, or null if Claude didn't return a structured response.
export function extractToolInput(content: unknown): Record<string, unknown> | null {
  if (!Array.isArray(content)) return null
  const block = content.find(
    (b) => b && typeof b === 'object' && (b as { type?: unknown }).type === 'tool_use'
  ) as { input?: unknown } | undefined
  if (!block || typeof block.input !== 'object' || block.input === null) return null
  return block.input as Record<string, unknown>
}

// Concatenates the text blocks of a response's `content` array (used by OCR,
// which has no tool and returns plain text).
export function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (b): b is { type: 'text'; text: string } =>
        Boolean(b) && typeof b === 'object' && (b as { type?: unknown }).type === 'text'
    )
    .map((b) => b.text)
    .join('')
    .trim()
}
