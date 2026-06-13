import { useEffect, useRef, useState } from 'react'
import type { Lookup } from '@shared/types'
import { deleteLookup, incrementRelevance, listHistory } from '../lib/api'
import {
  getCached,
  isStale,
  removeCached,
  replaceCached,
  setCached,
  type HistoryFilter,
  type HistorySort
} from '../lib/historyCache'
import { useLanguage } from '../lib/language'
import { LanguageSelector } from './LanguageSelector'
import { ResultCard } from './ResultCard'

const PAGE_SIZE = 20

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'word', label: 'Words' },
  { value: 'phrase', label: 'Phrases' }
]

const SORT_OPTIONS: { value: HistorySort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'relevant', label: 'Most relevant' }
]

// Ids whose expansion already counted toward relevance this app session.
// Module scope so tab switches (remounts) don't recount the same card.
const expandedOnce = new Set<string>()

export function HistoryView(): JSX.Element {
  const { language } = useLanguage()
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [sort, setSort] = useState<HistorySort>('newest')
  const initial = getCached(language, 'all', 'newest')
  const [items, setItems] = useState<Lookup[]>(initial?.items ?? [])
  const [hasMore, setHasMore] = useState<boolean>(initial?.hasMore ?? false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Last search query that already counted toward relevance, so retyping the
  // same query (or a refresh) doesn't inflate the counter.
  const lastCountedSearch = useRef('')

  // Type filter to pass to the API: undefined means "all types".
  const typeFilter = filter === 'all' ? undefined : filter

  // Applies a relevance bump optimistically to local state and the cache.
  function bumpLocal(item: Lookup): Lookup {
    const bumped = { ...item, relevance: item.relevance + 1 }
    setItems((cur) => cur.map((i) => (i.id === bumped.id ? bumped : i)))
    replaceCached(bumped)
    return bumped
  }

  // Searching for a term and finding it is "checking it again": when the query
  // exactly matches a term, the most recent matching row earns +1, once per
  // distinct query. Partial matches never count.
  function countExactSearchMatch(q: string, results: Lookup[]): Lookup[] {
    const norm = q.toLowerCase()
    if (norm === lastCountedSearch.current) return results
    const match = results.find((i) => i.term.trim().toLowerCase() === norm)
    if (!match) return results
    lastCountedSearch.current = norm
    void incrementRelevance(match.id)
    const bumped = { ...match, relevance: match.relevance + 1 }
    replaceCached(bumped)
    return results.map((i) => (i.id === bumped.id ? bumped : i))
  }

  async function loadFirstPage(q?: string): Promise<void> {
    setError(null)
    setRefreshing(true)
    const res = await listHistory({
      search: q,
      limit: PAGE_SIZE,
      language,
      type: typeFilter,
      sort
    })
    setRefreshing(false)
    if (res.ok) {
      const more = res.data.length === PAGE_SIZE
      const data = q ? countExactSearchMatch(q.trim(), res.data) : res.data
      setItems(data)
      setHasMore(more)
      if (!q) setCached(data, more, language, filter, sort)
    } else {
      setError(res.error)
    }
  }

  async function loadMore(): Promise<void> {
    const last = items[items.length - 1]
    if (!last || loadingMore || !hasMore) return
    setError(null)
    setLoadingMore(true)
    const res = await listHistory({
      search: search.trim() || undefined,
      // Relevance order has no stable timestamp cursor — page by offset there.
      before: sort === 'newest' ? last.createdAt : undefined,
      offset: sort === 'relevant' ? items.length : undefined,
      limit: PAGE_SIZE,
      language,
      type: typeFilter,
      sort
    })
    setLoadingMore(false)
    if (res.ok) {
      setItems((cur) => [...cur, ...res.data])
      setHasMore(res.data.length === PAGE_SIZE)
    } else {
      setError(res.error)
    }
  }

  // Load (or reload) the first page when:
  //   - a search query changes,
  //   - the selected language, type filter, or sort changes, or
  //   - no search and cache is stale/empty (cache is keyed by language+filter+sort).
  useEffect(() => {
    const q = search.trim() || undefined
    if (!q && !isStale(language, filter, sort)) {
      // Switched back to a page that's still fresh — show it.
      const cached = getCached(language, filter, sort)
      if (cached) {
        setItems(cached.items)
        setHasMore(cached.hasMore)
      }
      return
    }
    const t = setTimeout(() => void loadFirstPage(q), q ? 200 : 0)
    return () => clearTimeout(t)
  }, [search, language, filter, sort])

  async function onDelete(id: string): Promise<void> {
    const res = await deleteLookup(id)
    if (res.ok) {
      setItems((cur) => cur.filter((i) => i.id !== id))
      removeCached(id)
    } else {
      setError(res.error)
    }
  }

  // Expanding a compact card is "checking it again": +1, once per session.
  function onCardExpand(item: Lookup): void {
    if (expandedOnce.has(item.id)) return
    expandedOnce.add(item.id)
    void incrementRelevance(item.id)
    bumpLocal(item)
  }

  return (
    <div className="history">
      <LanguageSelector disabled={refreshing} />
      <div className="type-filter" role="radiogroup" aria-label="Lookup type">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={filter === opt.value ? 'type-option active' : 'type-option'}
            role="radio"
            aria-checked={filter === opt.value}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="type-filter" role="radiogroup" aria-label="Sort order">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={sort === opt.value ? 'type-option active' : 'type-option'}
            role="radio"
            aria-checked={sort === opt.value}
            onClick={() => setSort(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="history-toolbar">
        <input
          className="search"
          placeholder="Search words or phrases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="icon-btn"
          title="Refresh"
          onClick={() => void loadFirstPage(search.trim() || undefined)}
          disabled={refreshing}
        >
          {refreshing ? '…' : '⟳'}
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {items.length === 0 ? (
        <div className="empty">
          {refreshing ? 'Loading…' : 'No lookups yet.'}
        </div>
      ) : (
        <>
          <ul className="history-list">
            {items.map((item) => (
              <li key={item.id}>
                <ResultCard
                  lookup={item}
                  onDelete={() => void onDelete(item.id)}
                  onExpand={() => onCardExpand(item)}
                  compact
                />
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              className="load-more"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
          {!hasMore && items.length >= PAGE_SIZE && (
            <div className="end-of-list">End of history.</div>
          )}
        </>
      )}
    </div>
  )
}
