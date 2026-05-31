import { createContext, useContext, useEffect, useState } from 'react'
import type { Language } from '@shared/types'

// The target languages a reader can study. A lookup is authored entirely in the
// selected language — we never translate between them.
export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' }
]

const STORAGE_KEY = 'vocab.language'
const DEFAULT_LANGUAGE: Language = 'en'

function isLanguage(value: unknown): value is Language {
  return LANGUAGE_OPTIONS.some((o) => o.code === value)
}

function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    // localStorage may be unavailable; fall through to default.
  }
  return DEFAULT_LANGUAGE
}

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageState>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {}
})

export function useLanguage(): LanguageState {
  return useContext(LanguageContext)
}

export function LanguageProvider({
  children
}: {
  children: React.ReactNode
}): JSX.Element {
  const [language, setLanguageState] = useState<Language>(loadLanguage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // Ignore persistence failures.
    }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState }}>
      {children}
    </LanguageContext.Provider>
  )
}
