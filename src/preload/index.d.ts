import type { MainApi } from '@shared/types'

declare global {
  interface Window {
    api?: MainApi
  }
}

export {}
