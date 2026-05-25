import { useEffect, useState } from 'react'
import type { Lookup } from '@shared/types'
import { deleteLookup, listHistory } from '../lib/api'
import { ResultCard } from './ResultCard'

export function HistoryView(): JSX.Element {
  const [items, setItems] = useState<Lookup[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function refresh(q?: string): Promise<void> {
    setError(null)
    const res = await listHistory(q)
    if (res.ok) setItems(res.data)
    else setError(res.error)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void refresh(search.trim() || undefined), 200)
    return () => clearTimeout(t)
  }, [search])

  async function onDelete(id: string): Promise<void> {
    const res = await deleteLookup(id)
    if (res.ok) setItems((cur) => cur.filter((i) => i.id !== id))
    else setError(res.error)
  }

  return (
    <div className="history">
      <input
        className="search"
        placeholder="Search words or paragraphs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
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
