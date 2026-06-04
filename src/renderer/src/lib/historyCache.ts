import type { Language, Lookup, LookupType } from '@shared/types'

// In-memory cache of the first page of history. Survives tab switches in the
// same window session; resets on page reload and on sign-out. Each cached page
// is keyed by the (language, filter) pair it was fetched for, since History is
// browsed one language at a time and can be filtered by type.

// The type filter shown in History: every type, or just one of them.
export type HistoryFilter = 'all' | LookupType

interface Cache {
  items: Lookup[]
  hasMore: boolean
  fetchedAt: number
}

const caches = new Map<string, Cache>()
const STALE_AFTER_MS = 60_000

function keyOf(language: Language, filter: HistoryFilter): string {
  return `${language}:${filter}`
}

// True when a given filter's page should include `item` (matches its type).
function filterMatches(filter: HistoryFilter, type: LookupType): boolean {
  return filter === 'all' || filter === type
}

export function getCached(
  language: Language,
  filter: HistoryFilter
): { items: Lookup[]; hasMore: boolean } | null {
  const cache = caches.get(keyOf(language, filter))
  if (!cache) return null
  return { items: cache.items, hasMore: cache.hasMore }
}

export function isStale(language: Language, filter: HistoryFilter): boolean {
  const cache = caches.get(keyOf(language, filter))
  if (!cache) return true
  return Date.now() - cache.fetchedAt > STALE_AFTER_MS
}

export function setCached(
  items: Lookup[],
  hasMore: boolean,
  language: Language,
  filter: HistoryFilter
): void {
  caches.set(keyOf(language, filter), {
    items,
    hasMore,
    fetchedAt: Date.now()
  })
}

export function prependCached(item: Lookup): void {
  // A new lookup belongs at the top of every cached page whose language matches
  // and whose filter would include this item's type (e.g. both 'all' and the
  // matching type page).
  for (const [key, cache] of caches) {
    const [language, filter] = key.split(':') as [Language, HistoryFilter]
    if (language !== item.language) continue
    if (!filterMatches(filter, item.type)) continue
    caches.set(key, {
      ...cache,
      items: [item, ...cache.items.filter((i) => i.id !== item.id)]
    })
  }
}

// Replaces an item in place (same position) in every cached page that holds it.
// Used when a lookup is updated without changing its recency, e.g. after its
// etymology is generated.
export function replaceCached(item: Lookup): void {
  for (const [key, cache] of caches) {
    if (!cache.items.some((i) => i.id === item.id)) continue
    caches.set(key, {
      ...cache,
      items: cache.items.map((i) => (i.id === item.id ? item : i))
    })
  }
}

export function removeCached(id: string): void {
  for (const [key, cache] of caches) {
    caches.set(key, {
      ...cache,
      items: cache.items.filter((i) => i.id !== id)
    })
  }
}

export function clearCache(): void {
  caches.clear()
}
