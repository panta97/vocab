import { useState } from 'react'
import type { Lookup } from '@shared/types'

interface Props {
  lookup: Lookup
  onDelete?: () => void
  compact?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function ResultCard({ lookup, onDelete, compact }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(!compact)
  return (
    <article className="result-card">
      <header className="result-head">
        <div>
          <div className="result-word">{lookup.word}</div>
          <div className="result-date">{formatDate(lookup.createdAt)}</div>
        </div>
        <div className="result-actions">
          {compact && (
            <button
              className="icon-btn"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          )}
          {onDelete && (
            <button className="icon-btn danger" onClick={onDelete} title="Delete">
              🗑
            </button>
          )}
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

          <details className="result-paragraph">
            <summary>Paragraph</summary>
            <blockquote>{lookup.paragraph}</blockquote>
          </details>
        </>
      )}
    </article>
  )
}
