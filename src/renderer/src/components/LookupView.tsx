import { useRef, useState } from 'react'
import type { Lookup } from '@shared/types'
import { lookupWord } from '../lib/api'
import { ResultCard } from './ResultCard'

export function LookupView(): JSX.Element {
  const [paragraph, setParagraph] = useState('')
  const [selectedWord, setSelectedWord] = useState('')
  const [result, setResult] = useState<Lookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  function captureSelection(): void {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart, selectionEnd, value } = ta
    if (selectionStart === selectionEnd) {
      setSelectedWord('')
      return
    }
    setSelectedWord(value.slice(selectionStart, selectionEnd).trim())
  }

  async function onLookup(): Promise<void> {
    setError(null)
    setResult(null)

    const ta = textareaRef.current
    const word = ta
      ? ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() || selectedWord
      : selectedWord

    if (!word) {
      setError('Highlight the word you want to look up in the paragraph above.')
      return
    }
    if (!paragraph.trim()) {
      setError('Paste a paragraph first.')
      return
    }

    setLoading(true)
    const res = await lookupWord({ word, paragraph })
    setLoading(false)

    if (res.ok) {
      setResult(res.data)
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="lookup">
      <label className="label" htmlFor="paragraph">
        Paragraph
      </label>
      <textarea
        id="paragraph"
        ref={textareaRef}
        className="paragraph-input"
        placeholder="Paste the paragraph here, then highlight the word you don't understand…"
        value={paragraph}
        onChange={(e) => setParagraph(e.target.value)}
        onSelect={captureSelection}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        rows={6}
      />

      <div className="selected-row">
        <span className="selected-label">Highlighted:</span>
        <span className={selectedWord ? 'selected-word' : 'selected-word empty'}>
          {selectedWord || 'nothing selected'}
        </span>
      </div>

      <button
        className="primary"
        onClick={() => void onLookup()}
        disabled={loading}
      >
        {loading ? 'Asking Claude…' : 'Explain in context'}
      </button>

      {error && <div className="banner error">{error}</div>}
      {result && <ResultCard lookup={result} />}
    </div>
  )
}
