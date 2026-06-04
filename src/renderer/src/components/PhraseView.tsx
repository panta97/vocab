import { useState } from 'react'
import type { Lookup } from '@shared/types'
import { lookupPhrase } from '../lib/api'
import { prependCached } from '../lib/historyCache'
import { useLanguage } from '../lib/language'
import { LanguageSelector } from './LanguageSelector'
import { ResultCard } from './ResultCard'

export function PhraseView(): JSX.Element {
  const { language } = useLanguage()
  const [phrase, setPhrase] = useState('')
  const [result, setResult] = useState<Lookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onLookup(): Promise<void> {
    setError(null)
    setResult(null)

    const trimmed = phrase.trim()
    if (!trimmed) {
      setError('Enter an idiom or phrase to look up.')
      return
    }

    setLoading(true)
    const res = await lookupPhrase({ phrase: trimmed, language })
    setLoading(false)

    if (res.ok) {
      setResult(res.data)
      prependCached(res.data)
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="lookup">
      <LanguageSelector disabled={loading} />

      <div className="paragraph-head">
        <label className="label" htmlFor="phrase">
          Idiom or phrase
        </label>
      </div>
      <textarea
        id="phrase"
        className="paragraph-input"
        placeholder="Paste an idiom or short phrase on its own — e.g. “break the ice” — and get its most common meaning…"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        rows={3}
        disabled={loading}
      />

      <button
        className="primary"
        onClick={() => void onLookup()}
        disabled={loading}
      >
        {loading ? 'Asking Claude…' : 'Find meaning'}
      </button>

      {error && <div className="banner error">{error}</div>}
      {result && <ResultCard lookup={result} />}
    </div>
  )
}
