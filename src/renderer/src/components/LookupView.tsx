import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lookup } from '@shared/types'
import { extractTextFromImage, lookupWord } from '../lib/api'
import { prependCached } from '../lib/historyCache'
import { useLanguage } from '../lib/language'
import { LanguageSelector } from './LanguageSelector'
import { ResultCard } from './ResultCard'

export function LookupView(): JSX.Element {
  const { language } = useLanguage()
  const [paragraph, setParagraph] = useState('')
  const [selectedWord, setSelectedWord] = useState('')
  const [result, setResult] = useState<Lookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function runOcr(file: File): Promise<void> {
    setError(null)
    setExtracting(true)
    const res = await extractTextFromImage(file, language)
    setExtracting(false)

    if (res.ok) {
      setParagraph(res.data)
      setSelectedWord('')
    } else {
      setError(res.error)
    }
  }

  async function onImageSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = ''
    if (file) await runOcr(file)
  }

  function onDragOver(e: React.DragEvent): void {
    if (extracting) return
    // Only react when an image (file) is being dragged in.
    if (Array.from(e.dataTransfer.items).some((i) => i.kind === 'file')) {
      e.preventDefault()
      setDragging(true)
    }
  }

  function onDragLeave(e: React.DragEvent): void {
    // Ignore leave events bubbling up from children inside the drop zone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragging(false)
  }

  async function onDrop(e: React.DragEvent): Promise<void> {
    e.preventDefault()
    setDragging(false)
    if (extracting) return
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith('image/')
    )
    if (!file) {
      setError('Drop an image file (PNG, JPEG, WebP, or GIF).')
      return
    }
    await runOcr(file)
  }

  const captureSelection = useCallback((): void => {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart, selectionEnd, value } = ta
    if (selectionStart === selectionEnd) {
      setSelectedWord('')
      return
    }
    setSelectedWord(value.slice(selectionStart, selectionEnd).trim())
  }, [])

  // iOS Safari does not fire onSelect/onMouseUp/onKeyUp when text is selected
  // via the native touch handles — it only emits document-level selectionchange.
  // Listen for that and read the textarea's selection when it's the active field.
  useEffect(() => {
    function onSelectionChange(): void {
      if (document.activeElement === textareaRef.current) captureSelection()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [captureSelection])

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
    const res = await lookupWord({ word, paragraph, language })
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
        <label className="label" htmlFor="paragraph">
          Paragraph
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => void onImageSelected(e)}
        />
        <button
          className="secondary small"
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting || loading}
          title="Extract text from an image using OCR"
        >
          {extracting ? 'Extracting…' : '📷 Extract text from image'}
        </button>
      </div>
      <div
        className={dragging ? 'paragraph-drop dragging' : 'paragraph-drop'}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => void onDrop(e)}
      >
        <textarea
          id="paragraph"
          ref={textareaRef}
          className="paragraph-input"
          placeholder="Paste a paragraph, drag in an image, or use “Extract text from image” — then highlight the word you don't understand…"
          value={paragraph}
          onChange={(e) => setParagraph(e.target.value)}
          onSelect={captureSelection}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          rows={6}
          disabled={extracting}
        />
        {dragging && (
          <div className="drop-overlay">Drop image to extract text</div>
        )}
      </div>

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
