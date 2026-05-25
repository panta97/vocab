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

export function HistoryView(): JSX.Element {
  const [items, setItems] = useState<Lookup[]>(() => getCached() ?? [])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function refresh(q?: string): Promise<void> {
    setError(null)
    setRefreshing(true)
    const res = await listHistory(q)
    setRefreshing(false)
    if (res.ok) {
      setItems(res.data)
      if (!q) setCached(res.data)
    } else {
      setError(res.error)
    }
  }

  // Refetch when:
  //   - search query is set (always — search hits the network), or
  //   - no search and cache is stale/empty.
  useEffect(() => {
    const q = search.trim() || undefined
    if (!q && !isStale()) return
    const t = setTimeout(() => void refresh(q), q ? 200 : 0)
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
          onClick={() => void refresh(search.trim() || undefined)}
          disabled={refreshing}
        >
          {refreshing ? '…' : '⟳'}
        </button>
      </div>
      {error && <div className="banner error">{error}</div>}
      {items.length === 0 ? (
        <div className="empty">No lookups yet.</div>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <ResultCard lookup={item} onDelete={() => void onDelete(item.id)} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
