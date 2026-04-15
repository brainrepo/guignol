import type { Theme } from '../../../shared/types'

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function watchSystemTheme(cb: (dark: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent): void => cb(e.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
