import type { Language } from '@shared/types'
import { LANGUAGE_OPTIONS, useLanguage } from '../lib/language'

interface Props {
  // When set, the selector is disabled (e.g. while a lookup is in flight).
  disabled?: boolean
}

export function LanguageSelector({ disabled }: Props): JSX.Element {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="lang-selector" role="radiogroup" aria-label="Target language">
      <span className="label">Language</span>
      <div className="lang-options">
        {LANGUAGE_OPTIONS.map((opt) => (
          <label
            key={opt.code}
            className={language === opt.code ? 'lang-option active' : 'lang-option'}
          >
            <input
              type="radio"
              name="target-language"
              value={opt.code}
              checked={language === opt.code}
              onChange={() => setLanguage(opt.code as Language)}
              disabled={disabled}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}
