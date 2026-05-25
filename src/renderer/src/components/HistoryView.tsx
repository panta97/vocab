import { useEffect, useState } from 'react'
import type { Lookup } from '@shared/types'
import { deleteLookup, listHistory } from '../lib/api'
import {
  getCached,
  isStale,
  removeCached,
  setCached
} from '../lib/historyCache'
import { ResultCard } from './ResultCard'

const PAGE_SIZE = 20

export function HistoryView(): JSX.Element {
  const initial = getCached()
  const [items, setItems] = useState<Lookup[]>(initial?.items ?? [])
  const [hasMore, setHasMore] = useState<boolean>(initial?.hasMore ?? false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  async function loadFirstPage(q?: string): Promise<void> {
    setError(null)
    setRefreshing(true)
    const res = await listHistory({ search: q, limit: PAGE_SIZE })
    setRefreshing(false)
    if (res.ok) {
      const more = res.data.length === PAGE_SIZE
      setItems(res.data)
      setHasMore(more)
      if (!q) setCached(res.data, more)
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
      limit: PAGE_SIZE
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
  //   - a search query changes, or
  //   - no search and cache is stale/empty.
  useEffect(() => {
    const q = search.trim() || undefined
    if (!q && !isStale()) return
    const t = setTimeout(() => void loadFirstPage(q), q ? 200 : 0)
    return () => clearTimeout(t)
  }, [search])

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
