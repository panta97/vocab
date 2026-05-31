import type { Language, Lookup } from '@shared/types'

// In-memory cache of the first page of history for a single language. Survives
// tab switches in the same window session; resets on page reload, on sign-out,
// and whenever the selected language changes (the cache is keyed by language).

interface Cache {
  items: Lookup[]
  hasMore: boolean
  fetchedAt: number
  language: Language
}

let cache: Cache | null = null
const STALE_AFTER_MS = 60_000

export function getCached(
  language: Language
): { items: Lookup[]; hasMore: boolean } | null {
  if (!cache || cache.language !== language) return null
  return { items: cache.items, hasMore: cache.hasMore }
}

export function isStale(language: Language): boolean {
  if (!cache || cache.language !== language) return true
  return Date.now() - cache.fetchedAt > STALE_AFTER_MS
}

export function setCached(
  items: Lookup[],
  hasMore: boolean,
  language: Language
): void {
  cache = { items, hasMore, fetchedAt: Date.now(), language }
}

export function prependCached(item: Lookup): void {
  // Only mutate the cache when it holds the same language as the new lookup;
  // otherwise the cached page belongs to a different language view.
  if (!cache || cache.language !== item.language) return
  cache = {
    ...cache,
    items: [item, ...cache.items.filter((i) => i.id !== item.id)]
  }
}

export function removeCached(id: string): void {
  if (!cache) return
  cache = {
    ...cache,
    items: cache.items.filter((i) => i.id !== id)
  }
}

export function clearCache(): void {
  cache = null
}
