import { useState } from 'react'
import type { Lookup } from '@shared/types'
import { generateEtymology } from '../lib/api'
import { replaceCached } from '../lib/historyCache'

interface Props {
  lookup: Lookup
  onDelete?: () => void
  // Fired when a compact card goes from collapsed to expanded (not on collapse).
  onExpand?: () => void
  compact?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

// Treat the row as edited only when updatedAt is meaningfully later than
// createdAt (more than a second), to ignore insert-time clock jitter.
function wasEdited(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  if (isNaN(created) || isNaN(updated)) return false
  return updated - created > 1000
}

export function ResultCard({ lookup, onDelete, onExpand, compact }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(!compact)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Etymology is filled in on demand; seed from the row and update after fetch.
  const [etymology, setEtymology] = useState(lookup.etymology)
  const [tracing, setTracing] = useState(false)
  const [etyError, setEtyError] = useState<string | null>(null)

  async function onTraceEtymology(): Promise<void> {
    setEtyError(null)
    setTracing(true)
    const res = await generateEtymology(lookup.id)
    setTracing(false)
    if (res.ok) {
      setEtymology(res.data.etymology)
      replaceCached(res.data)
    } else {
      setEtyError(res.error)
    }
  }
  return (
    <article className="result-card">
      <header className="result-head">
        <div>
          <div className="result-word">
            <span>{lookup.term}</span>
            <span className={`type-badge ${lookup.type}`}>{lookup.type}</span>
            {compact && lookup.relevance > 0 && (
              <span className="relevance-badge" title="Times revisited">
                ★ {lookup.relevance}
              </span>
            )}
            {lookup.wordClass && (
              <span className="word-class">{lookup.wordClass}</span>
            )}
          </div>
          <div className="result-date">
            {formatDate(lookup.createdAt)}
            {wasEdited(lookup.createdAt, lookup.updatedAt) && (
              <span title={`Updated ${formatDate(lookup.updatedAt)}`}> · edited</span>
            )}
          </div>
        </div>
        <div className="result-actions">
          {compact && (
            <button
              className="icon-btn"
              onClick={() => {
                if (!expanded) onExpand?.()
                setExpanded((v) => !v)
              }}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          )}
          {onDelete &&
            (confirmingDelete ? (
              <span className="delete-confirm">
                <span className="delete-confirm-label">Delete?</span>
                <button
                  className="icon-btn danger"
                  onClick={() => {
                    setConfirmingDelete(false)
                    onDelete()
                  }}
                  title="Confirm delete"
                >
                  ✓
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setConfirmingDelete(false)}
                  title="Cancel"
                >
                  ✕
                </button>
              </span>
            ) : (
              <button
                className="icon-btn danger"
                onClick={() => setConfirmingDelete(true)}
                title="Delete"
              >
                🗑
              </button>
            ))}
        </div>
      </header>
      {expanded && (
        <>
          <div className="result-explanation">{lookup.explanation}</div>

          {lookup.synonyms.length > 0 && (
            <div className="result-section">
              <div className="section-label">Similar words</div>
              <div className="chip-row">
                {lookup.synonyms.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {lookup.examples.length > 0 && (
            <div className="result-section">
              <div className="section-label">Examples</div>
              <ul className="example-list">
                {lookup.examples.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {etymology ? (
            <details className="result-etymology">
              <summary>Etymology</summary>
              <div className="etymology-body">{etymology}</div>
            </details>
          ) : (
            <div className="result-section">
              <button
                className="secondary small"
                onClick={() => void onTraceEtymology()}
                disabled={tracing}
                title="Look up where this comes from"
              >
                {tracing ? 'Tracing…' : '✦ Trace etymology'}
              </button>
              {etyError && <div className="banner error">{etyError}</div>}
            </div>
          )}

          {lookup.type === 'word' && lookup.paragraph && (
            <details className="result-paragraph">
              <summary>Paragraph</summary>
              <blockquote>{lookup.paragraph}</blockquote>
            </details>
          )}
        </>
      )}
    </article>
  )
}
