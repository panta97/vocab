import { useEffect, useState } from 'react'
import type { Lookup } from '@shared/types'
import { deleteLookup, listHistory } from '../lib/api'
import {
  getCached,
  isStale,
  removeCached,
  setCached
} from '../lib/historyCache'
import { useLanguage } from '../lib/language'
import { LanguageSelector } from './LanguageSelector'
import { ResultCard } from './ResultCard'

const PAGE_SIZE = 20

export function HistoryView(): JSX.Element {
  const { language } = useLanguage()
  const initial = getCached(language)
  const [items, setItems] = useState<Lookup[]>(initial?.items ?? [])
  const [hasMore, setHasMore] = useState<boolean>(initial?.hasMore ?? false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadFirstPage(q?: string): Promise<void> {
    setError(null)
    setRefreshing(true)
    const res = await listHistory({ search: q, limit: PAGE_SIZE, language })
    setRefreshing(false)
    if (res.ok) {
      const more = res.data.length === PAGE_SIZE
      setItems(res.data)
      setHasMore(more)
      if (!q) setCached(res.data, more, language)
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
      before: last.createdAt,
      limit: PAGE_SIZE,
      language
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
  //   - the selected language changes, or
  //   - no search and cache is stale/empty (cache is keyed by language).
  useEffect(() => {
    const q = search.trim() || undefined
    if (!q && !isStale(language)) {
      // Switched back to a language whose page is still fresh — show it.
      const cached = getCached(language)
      if (cached) {
        setItems(cached.items)
        setHasMore(cached.hasMore)
      }
      return
    }
    const t = setTimeout(() => void loadFirstPage(q), q ? 200 : 0)
    return () => clearTimeout(t)
  }, [search, language])

  async function onDelete(id: string): Promise<void> {
    const res = await deleteLookup(id)
    if (res.ok) {
      setItems((cur) => cur.filter((i) => i.id !== id))
      removeCached(id)
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="history">
      <LanguageSelector disabled={refreshing} />
      <div className="history-toolbar">
        <input
          className="search"
          placeholder="Search words or paragraphs…"
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
