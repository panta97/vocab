import type { Language, Lookup, LookupType } from '@shared/types'

// In-memory cache of the first page of history. Survives tab switches in the
// same window session; resets on page reload and on sign-out. Each cached page
// is keyed by the (language, filter, sort) triple it was fetched for, since
// History is browsed one language at a time, can be filtered by type, and can
// be sorted by recency or relevance.

// The type filter shown in History: every type, or just one of them.
export type HistoryFilter = 'all' | LookupType

// The sort order shown in History: newest first, or most relevant first.
export type HistorySort = 'newest' | 'relevant'

interface Cache {
  items: Lookup[]
  hasMore: boolean
  fetchedAt: number
}

const caches = new Map<string, Cache>()
const STALE_AFTER_MS = 60_000

function keyOf(language: Language, filter: HistoryFilter, sort: HistorySort): string {
  return `${language}:${filter}:${sort}`
}

// True when a given filter's page should include `item` (matches its type).
function filterMatches(filter: HistoryFilter, type: LookupType): boolean {
  return filter === 'all' || filter === type
}

export function getCached(
  language: Language,
  filter: HistoryFilter,
  sort: HistorySort
): { items: Lookup[]; hasMore: boolean } | null {
  const cache = caches.get(keyOf(language, filter, sort))
  if (!cache) return null
  return { items: cache.items, hasMore: cache.hasMore }
}

export function isStale(
  language: Language,
  filter: HistoryFilter,
  sort: HistorySort
): boolean {
  const cache = caches.get(keyOf(language, filter, sort))
  if (!cache) return true
  return Date.now() - cache.fetchedAt > STALE_AFTER_MS
}

export function setCached(
  items: Lookup[],
  hasMore: boolean,
  language: Language,
  filter: HistoryFilter,
  sort: HistorySort
): void {
  caches.set(keyOf(language, filter, sort), {
    items,
    hasMore,
    fetchedAt: Date.now()
  })
}

export function prependCached(item: Lookup): void {
  // A new lookup belongs at the top of every cached newest-first page whose
  // language matches and whose filter would include this item's type (e.g.
  // both 'all' and the matching type page). Relevance-sorted pages are
  // invalidated instead: a fresh relevance-0 row doesn't belong at their top.
  for (const [key, cache] of caches) {
    const [language, filter, sort] = key.split(':') as [
      Language,
      HistoryFilter,
      HistorySort
    ]
    if (language !== item.language) continue
    if (!filterMatches(filter, item.type)) continue
    if (sort === 'relevant') {
      caches.delete(key)
      continue
    }
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
