import type { Lookup } from '@shared/types'

// In-memory cache of the first page of history. Survives tab switches in the
// same window session; resets on page reload and on sign-out.

interface Cache {
  items: Lookup[]
  hasMore: boolean
  fetchedAt: number
}

let cache: Cache | null = null
const STALE_AFTER_MS = 60_000

export function getCached(): { items: Lookup[]; hasMore: boolean } | null {
  if (!cache) return null
  return { items: cache.items, hasMore: cache.hasMore }
}

export function isStale(): boolean {
  if (!cache) return true
  return Date.now() - cache.fetchedAt > STALE_AFTER_MS
}

export function setCached(items: Lookup[], hasMore: boolean): void {
  cache = { items, hasMore, fetchedAt: Date.now() }
}

export function prependCached(item: Lookup): void {
  if (!cache) return
  cache = {
    items: [item, ...cache.items.filter((i) => i.id !== item.id)],
    hasMore: cache.hasMore,
    fetchedAt: cache.fetchedAt
  }
}

export function removeCached(id: string): void {
  if (!cache) return
  cache = {
    items: cache.items.filter((i) => i.id !== id),
    hasMore: cache.hasMore,
    fetchedAt: cache.fetchedAt
  }
}

export function clearCache(): void {
  cache = null
}
