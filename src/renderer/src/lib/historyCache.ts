import type { Lookup } from '@shared/types'

// In-memory cache of the last full history fetch. Survives tab switches
// in the same browser/window session; resets on page reload and on sign-out.

interface Cache {
  items: Lookup[]
  fetchedAt: number
}

let cache: Cache | null = null
const STALE_AFTER_MS = 60_000

export function getCached(): Lookup[] | null {
  return cache?.items ?? null
}

export function isStale(): boolean {
  if (!cache) return true
  return Date.now() - cache.fetchedAt > STALE_AFTER_MS
}

export function setCached(items: Lookup[]): void {
  cache = { items, fetchedAt: Date.now() }
}

export function prependCached(item: Lookup): void {
  if (!cache) return
  cache = {
    items: [item, ...cache.items.filter((i) => i.id !== item.id)],
    fetchedAt: cache.fetchedAt
  }
}

export function removeCached(id: string): void {
  if (!cache) return
  cache = {
    items: cache.items.filter((i) => i.id !== id),
    fetchedAt: cache.fetchedAt
  }
}

export function clearCache(): void {
  cache = null
}
